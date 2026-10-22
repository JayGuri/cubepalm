import { useCallback, useEffect, useRef } from 'react'
import type { HowRequest, HowResponse } from './how.worker'

/**
 * The page's background thread, started only once `enabled` (its section has
 * come near the screen) and stopped when the section goes away. Messages go to
 * whichever `onMessage` was passed last.
 */
export function useHowWorker(enabled: boolean, onMessage: (r: HowResponse) => void) {
  const worker = useRef<Worker | null>(null)
  const handler = useRef(onMessage)
  useEffect(() => {
    handler.current = onMessage
  })
  useEffect(() => {
    if (!enabled || typeof Worker === 'undefined') return
    let w: Worker
    try {
      w = new Worker(new URL('./how.worker.ts', import.meta.url), { type: 'module' })
    } catch {
      handler.current({ id: -1, type: 'error', message: 'This browser could not start a background thread.' })
      return
    }
    w.onmessage = (e: MessageEvent<HowResponse>) => handler.current(e.data)
    w.onerror = () => handler.current({ id: -1, type: 'error', message: 'The background thread stopped.' })
    worker.current = w
    return () => {
      w.terminate()
      worker.current = null
    }
  }, [enabled])
  return useCallback((request: HowRequest) => {
    if (!worker.current) return false
    worker.current.postMessage(request)
    return true
  }, [])
}
