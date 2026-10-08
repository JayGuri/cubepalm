import type { LandmarkFrame } from './landmarks'
import type { TrackerRequest, TrackerResponse } from './handTracker.worker'

// Finds hands in camera frames. A worker does it when the browser allows
// (nothing then blocks the page); otherwise the main thread does, at a rate it
// can afford.

export interface HandTracker {
  /** Where the model is running. */
  readonly where: 'worker' | 'main'
  /** Which processor the model is on. */
  readonly delegate: 'GPU' | 'CPU'
  /** The hands in the video's current frame; null if this frame was skipped. */
  detect(video: HTMLVideoElement, timestampMs: number): Promise<LandmarkFrame | null>
  dispose(): void
}

// A worker that cannot start usually says so at once; one that hangs must not
// leave Hands mode waiting for ever.
const WORKER_START_MS = 45_000

function startWorkerTracker(): Promise<HandTracker> {
  return new Promise((resolve, reject) => {
    if (typeof Worker === 'undefined' || typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') {
      reject(new Error('no worker support'))
      return
    }
    const worker = new Worker(new URL('./handTracker.worker.ts', import.meta.url), { type: 'module' })
    let waiting: ((frame: LandmarkFrame | null) => void) | null = null
    const giveUp = (reason: string) => {
      clearTimeout(timer)
      worker.terminate()
      waiting?.(null)
      reject(new Error(reason))
    }
    const timer = setTimeout(() => giveUp('hand-tracking worker did not start'), WORKER_START_MS)
    worker.onerror = () => giveUp('hand-tracking worker failed to load')
    worker.onmessage = (e: MessageEvent<TrackerResponse>) => {
      const message = e.data
      if (message.type === 'failed') return giveUp(message.error)
      if (message.type === 'result') {
        const done = waiting
        waiting = null
        done?.(message.frame)
        return
      }
      clearTimeout(timer)
      resolve({
        where: 'worker',
        delegate: message.delegate,
        async detect(video, timestampMs) {
          // One frame in flight at a time: a slow device drops frames instead of queueing them.
          if (waiting) return null
          const bitmap = await createImageBitmap(video)
          return new Promise<LandmarkFrame | null>((done) => {
            waiting = done
            worker.postMessage({ type: 'frame', bitmap, timestampMs } satisfies TrackerRequest, [bitmap])
          })
        },
        dispose() {
          worker.terminate()
          waiting?.(null)
          waiting = null
        },
      })
    }
    worker.postMessage({ type: 'init' } satisfies TrackerRequest)
  })
}

async function startMainTracker(): Promise<HandTracker> {
  // MediaPipe's code is only downloaded here, the first time it is needed.
  const { HandLandmarkerService } = await import('./HandLandmarkerService')
  const service = new HandLandmarkerService()
  await service.init()
  return {
    where: 'main',
    delegate: service.delegate ?? 'CPU',
    detect: async (video, timestampMs) => service.detect(video, timestampMs),
    dispose: () => service.dispose(),
  }
}

/** The worker if it will start, the main thread if not. Rejects only if neither can run the model. */
export async function createHandTracker(): Promise<HandTracker> {
  try {
    return await startWorkerTracker()
  } catch {
    return startMainTracker()
  }
}
