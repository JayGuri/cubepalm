import { useEffect, useRef, useState, type RefObject } from 'react'
import { startCamera, stopCamera } from './camera'
import { createHandTracker, type HandTracker } from './handTracker'
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

/**
 * Camera frames as they arrive, about 25 a second. This is deliberately not
 * React state: a screen that re-rendered on every frame spent most of its time
 * re-rendering. Whoever needs a frame subscribes, does its sums outside React,
 * and only sets state when something a person can see has changed.
 */
export interface GestureFeed {
  subscribe(listener: (frame: LandmarkFrame, events: GestureEvent[]) => void): () => void
}

type FrameListener = (frame: LandmarkFrame, events: GestureEvent[]) => void

/** A feed plus the means to push frames into it. */
export function createGestureFeed(): GestureFeed & { emit: FrameListener } {
  const listeners = new Set<FrameListener>()
  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    emit(frame, events) {
      for (const listener of listeners) listener(frame, events)
    },
  }
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
  feed: GestureFeed
  /** Where the hand model ended up running, e.g. "worker/GPU"; null until it has started. */
  tracker: string | null
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
  const trackerRef = useRef<HandTracker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const gestureStateRef = useRef<GestureState>(createInitialGestureState())
  const lastTickAtRef = useRef(0)
  const [feed] = useState(createGestureFeed)

  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [tracker, setTracker] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    async function setup() {
      let stream: MediaStream | null = null
      let model: Promise<HandTracker> | null = null
      try {
        // Ask for the camera straight away so the browser's permission prompt
        // appears the moment Hands is chosen. The hand model (a few MB) loads
        // alongside it instead of in front of it, in a worker where it can.
        model = createHandTracker()
        const [service, camera] = await Promise.all([model, startCamera().then((s) => (stream = s))])
        if (cancelled) {
          stopCamera(camera)
          service.dispose()
          return
        }
        trackerRef.current = service
        setTracker(`${service.where}/${service.delegate}`)
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
      setTracker(null)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      stopCamera(streamRef.current)
      streamRef.current = null
      trackerRef.current?.dispose()
      trackerRef.current = null
      gestureStateRef.current = createInitialGestureState()
    }
  }, [enabled])

  // Everything downstream of detection, shared by the camera loop and the
  // dev-only injection seam below.
  const processFrame = (f: LandmarkFrame) => {
    const result = stepGesture(gestureStateRef.current, f, thresholds)
    gestureStateRef.current = result.nextState
    feed.emit(f, result.events)
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
    const w = window as unknown as { __cubepalmInjectFrame?: (f: LandmarkFrame) => void }
    w.__cubepalmInjectFrame = (f) => processFrameRef.current(f)
    return () => {
      delete w.__cubepalmInjectFrame
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const baseIntervalMs = 1000 / targetFps
    let alive = true
    let busy = false
    // How long a detection has been taking, smoothed.
    let costMs = 0

    const loop = () => {
      if (!alive) return
      rafRef.current = requestAnimationFrame(loop)
      const now = performance.now()
      const video = videoRef.current
      const tracker = trackerRef.current
      if (busy || !video || !tracker || video.readyState < 2) return
      // On the main thread a detection blocks drawing, so it may take at most
      // about a third of the time: a slow device tracks at a lower rate rather
      // than stuttering. In a worker it blocks nothing.
      const interval = tracker.where === 'main' ? Math.max(baseIntervalMs, costMs * 3) : baseIntervalMs
      if (now - lastTickAtRef.current < interval) return
      lastTickAtRef.current = now
      busy = true
      tracker
        .detect(video, now)
        .then((f) => {
          costMs = costMs === 0 ? performance.now() - now : costMs * 0.8 + (performance.now() - now) * 0.2
          if (alive && f) processFrameRef.current(f)
        })
        .catch(() => undefined)
        .finally(() => {
          busy = false
        })
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      alive = false
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [enabled, thresholds, targetFps])

  return { videoRef, feed, tracker, error, ready }
}

