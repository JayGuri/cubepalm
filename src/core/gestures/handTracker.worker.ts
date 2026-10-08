/// <reference lib="webworker" />
import { HandLandmarkerService } from './HandLandmarkerService'
import type { LandmarkFrame } from './landmarks'

// Hand tracking off the main thread. Finding two hands in a camera frame takes
// tens of milliseconds; done on the main thread, 25 times a second, that leaves
// little time to draw the cube. Here it costs the page nothing but the copy of
// the frame.

export type TrackerRequest = { type: 'init' } | { type: 'frame'; bitmap: ImageBitmap; timestampMs: number }

export type TrackerResponse =
  | { type: 'ready'; delegate: 'GPU' | 'CPU' }
  | { type: 'failed'; error: string }
  | { type: 'result'; frame: LandmarkFrame | null }

// MediaPipe loads its runtime with a dynamic import of a file we serve from
// /mediapipe/wasm, and looks for `self.import` to do it with. The dev server
// rewrites every import() it can see and refuses to serve files in public/ as
// modules, so this one is built where it cannot see it. In a production build
// it is simply the browser's own import().
const nativeImport = new Function('url', 'return import(url)') as (url: string) => Promise<unknown>
;(self as unknown as { import: typeof nativeImport }).import = nativeImport

const service = new HandLandmarkerService()
const reply = (message: TrackerResponse) => self.postMessage(message)

self.onmessage = async (e: MessageEvent<TrackerRequest>) => {
  const request = e.data
  if (request.type === 'init') {
    try {
      await service.init(true)
      reply({ type: 'ready', delegate: service.delegate ?? 'CPU' })
    } catch (err) {
      reply({ type: 'failed', error: (err as Error).message })
    }
    return
  }
  let frame: LandmarkFrame | null = null
  try {
    frame = service.detect(request.bitmap, request.timestampMs)
  } catch {
    // One bad frame is not worth stopping for; the next one gets its own try.
  } finally {
    request.bitmap.close()
  }
  reply({ type: 'result', frame })
}
