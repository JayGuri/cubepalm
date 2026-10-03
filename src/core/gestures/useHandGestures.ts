import { useEffect, useRef, useState, type RefObject } from 'react'
import { startCamera, stopCamera } from './camera'
import type { HandLandmarkerService } from './HandLandmarkerService'
import type { LandmarkFrame } from './landmarks'
import {
  createInitialGestureState,
  stepGesture,
  type GestureEvent,
  type GestureState,
  type GestureThresholds,
} from './GestureRecognizer'

// Task 4.5: connects a live camera through HandLandmarkerService and the pure
// gesture FSM. Everything below this hook (the FSM itself) is unit-tested
// without a camera; this hook is the thin, inherently-manual-test seam that
// wires it to a real getUserMedia stream (spec 8.1/12.2).

export interface GestureTick {
  seq: number
  events: GestureEvent[]
}

export interface UseHandGesturesOptions {
  enabled: boolean
  thresholds: GestureThresholds
  // Gesture state updates are throttled independently of the render loop
  // (spec 12.2); the render loop itself must stay uncapped.
  targetFps?: number
}

export interface UseHandGesturesResult {
  videoRef: RefObject<HTMLVideoElement | null>
  frame: LandmarkFrame | null
  gestureState: GestureState
  tick: GestureTick | null
  error: string | null
  ready: boolean
}

/** What a camera failure means to a person, not to a browser. */
function friendlyCameraError(e: unknown): string {
  const name = (e as { name?: string })?.name
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Camera is blocked. Allow it from the lock icon in the address bar, then switch to Hands again.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera found on this device.'
  if (name === 'NotReadableError') return 'The camera is busy in another app. Close it and switch to Hands again.'
  return (e as Error)?.message || 'The camera could not start.'
}

export function useHandGestures(options: UseHandGesturesOptions): UseHandGesturesResult {
  const { enabled, thresholds, targetFps = 25 } = options

  const videoRef = useRef<HTMLVideoElement>(null)
  const serviceRef = useRef<HandLandmarkerService | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const gestureStateRef = useRef<GestureState>(createInitialGestureState())
  const lastTickAtRef = useRef(0)
  const seqRef = useRef(0)

  const [frame, setFrame] = useState<LandmarkFrame | null>(null)
  const [tick, setTick] = useState<GestureTick | null>(null)
  const [gestureState, setGestureState] = useState<GestureState>(createInitialGestureState)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    async function setup() {
      let stream: MediaStream | null = null
      let model: Promise<HandLandmarkerService> | null = null
      try {
        // Ask for the camera straight away so the browser's permission prompt
        // appears the moment Hands is chosen. The hand model (a few MB) loads
        // alongside it instead of in front of it.
        // MediaPipe's code is only downloaded here, the first time Hands is chosen.
        model = import('./HandLandmarkerService').then(async (m) => {
          const service = new m.HandLandmarkerService()
          await service.init()
          return service
        })
        const [service, camera] = await Promise.all([model, startCamera().then((s) => (stream = s))])
        if (cancelled) {
          stopCamera(camera)
          service.dispose()
          return
        }
        serviceRef.current = service
        streamRef.current = camera
        if (videoRef.current) {
          videoRef.current.srcObject = camera
          await videoRef.current.play()
        }
        setReady(true)
      } catch (e) {
        stopCamera(stream)
        // Whichever half failed, the other must not be left running.
        void model?.then((service) => service.dispose()).catch(() => undefined)
        if (!cancelled) setError(friendlyCameraError(e))
      }
    }
    void setup()

    return () => {
      cancelled = true
      setReady(false)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      stopCamera(streamRef.current)
      streamRef.current = null
      serviceRef.current?.dispose()
      serviceRef.current = null
      gestureStateRef.current = createInitialGestureState()
    }
  }, [enabled])

  // Everything downstream of detection, shared by the camera loop and the
  // dev-only injection seam below.
  const processFrame = (f: LandmarkFrame) => {
    setFrame(f)
    const result = stepGesture(gestureStateRef.current, f, thresholds)
    gestureStateRef.current = result.nextState
    setGestureState(result.nextState)


    seqRef.current += 1
    setTick({ seq: seqRef.current, events: result.events })
  }

  // DEV ONLY (compiled out of production builds): lets end-to-end tests drive
  // the real app with synthetic hand frames, since CI has no camera or hands.
  // Every step after MediaPipe's detection runs exactly as it does live.
  const processFrameRef = useRef(processFrame)
  useEffect(() => {
    processFrameRef.current = processFrame
  })
  useEffect(() => {
    if (!import.meta.env.DEV || !enabled) return
    const w = window as unknown as { __palmtwistInjectFrame?: (f: LandmarkFrame) => void }
    w.__palmtwistInjectFrame = (f) => processFrameRef.current(f)
    return () => {
      delete w.__palmtwistInjectFrame
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const minIntervalMs = 1000 / targetFps

    const loop = () => {
      const now = performance.now()
      const video = videoRef.current
      const service = serviceRef.current
      if (video && service?.ready && video.readyState >= 2 && now - lastTickAtRef.current >= minIntervalMs) {
        lastTickAtRef.current = now
        const f = service.detect(video, now)
        if (f) processFrameRef.current(f)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [enabled, thresholds, targetFps])

  return { videoRef, frame, gestureState, tick, error, ready }
}

