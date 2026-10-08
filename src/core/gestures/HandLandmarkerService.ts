import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision'
import type { Handedness, LandmarkFrame } from './landmarks'

// Thin wrapper over MediaPipe (spec 8.1). Everything downstream consumes the
// plain LandmarkFrame shape instead of MediaPipe types, which is what keeps the
// gesture FSM testable without this file, a camera, or WASM.

const WASM_PATH = '/mediapipe/wasm'
const MODEL_PATH = '/models/hand_landmarker.task'

export class HandLandmarkerService {
  private landmarker: HandLandmarker | null = null
  private lastTimestamp = -1
  /** Which processor the model ended up on; null until it has started. */
  delegate: 'GPU' | 'CPU' | null = null

  /** `inWorker`: load the build of the runtime that a module worker can import. */
  async init(inWorker = false): Promise<void> {
    if (this.landmarker) return
    // Both the runtime and the model are served from our own origin, so the app
    // keeps working offline after first load and never depends on a CDN.
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH, inWorker)
    const create = (delegate: 'GPU' | 'CPU') =>
      HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate },
        runningMode: 'VIDEO',
        numHands: 2,
      })
    // The GPU is several times faster, but some browsers and drivers refuse it.
    // The CPU always works, so try that before giving up.
    try {
      this.landmarker = await create('GPU')
      this.delegate = 'GPU'
    } catch {
      try {
        this.landmarker = await create('CPU')
        this.delegate = 'CPU'
      } catch (cause) {
        throw new Error(
          `Hand tracking could not start on this device (neither its graphics card nor its processor could run the model). ${(cause as Error)?.message ?? ''}`.trim(),
        )
      }
    }
  }

  get ready(): boolean {
    return this.landmarker !== null
  }

  /** Runs detection for one video frame and converts it to a LandmarkFrame. */
  detect(video: HTMLVideoElement | ImageBitmap, timestampMs: number): LandmarkFrame | null {
    if (!this.landmarker) return null
    // MediaPipe rejects a timestamp that does not advance; a paused or stalled
    // video replays the same one, so skip rather than throw.
    if (timestampMs <= this.lastTimestamp) return null
    this.lastTimestamp = timestampMs
    return toLandmarkFrame(this.landmarker.detectForVideo(video, timestampMs), timestampMs)
  }

  dispose(): void {
    this.landmarker?.close()
    this.landmarker = null
    this.delegate = null
    this.lastTimestamp = -1
  }
}

function toLandmarkFrame(
  result: HandLandmarkerResult,
  timestampMs: number,
): LandmarkFrame {
  const hands = (result.landmarks ?? []).map((landmarks, i) => {
    const category = result.handedness?.[i]?.[0]
    return {
      landmarks: landmarks.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      handedness: (category?.categoryName === 'Left' ? 'Left' : 'Right') as Handedness,
      score: category?.score ?? 0,
    }
  })
  return { hands, timestampMs }
}
