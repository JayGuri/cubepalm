import { useEffect, useRef, useState } from 'react'
import type { Move } from '../../../core/puzzles/PuzzlePlugin'
import { usePuzzleStore } from '../../../state/puzzleStore'

// Far longer than any turn takes to draw (220 ms at normal speed).
const ANIMATION_WATCHDOG_MS = 3000

/**
 * The one line every turn of the cube waits in -- a drag, a key, a hand sign, a
 * scramble, a solution. Each turn is applied to the store at once (so the solver
 * and the game logic always see the true position) while the canvas is told
 * which turn is "in flight" and draws it turning into place; only when it
 * reports the turn drawn does the next one start. That is what makes Scramble
 * and Solve visibly play move by move instead of teleporting.
 */
export function useMoveQueue() {
  const applyMove = usePuzzleStore((s) => s.applyMove)
  const [animatingMove, setAnimatingMove] = useState<Move | null>(null)
  const [busy, setBusy] = useState(false)
  const animResolveRef = useRef<(() => void) | null>(null)
  const animTimerRef = useRef<number | undefined>(undefined)
  const queueRef = useRef<Move[]>([])
  const processingRef = useRef(false)
  const drainPromiseRef = useRef<Promise<void>>(Promise.resolve())
  // Bumped whenever the queue is flushed, so an operation that was mid-await
  // can tell the cube was replaced under it.
  const generationRef = useRef(0)
  // Key and sign handlers are created once, so they read busy from a ref.
  const busyRef = useRef(false)

  // The turn in flight is over, however it ended: the canvas finished drawing
  // it, the watchdog gave up on it, or the queue was flushed under it.
  const handleAnimationComplete = () => {
    window.clearTimeout(animTimerRef.current)
    setAnimatingMove(null)
    const resolve = animResolveRef.current
    animResolveRef.current = null
    resolve?.()
  }

  const applyAnimated = (move: Move) =>
    new Promise<void>((resolve) => {
      animResolveRef.current = resolve
      applyMove(move)
      setAnimatingMove(move)
      // The store already holds the move; only the drawing is pending. If the
      // canvas never reports back (no WebGL, a lost context, a hidden tab whose
      // frames are paused) the queue must still move on rather than hang.
      animTimerRef.current = window.setTimeout(handleAnimationComplete, document.hidden ? 0 : ANIMATION_WATCHDOG_MS)
    })

  // Every caller gets the SAME promise for the drain in progress, so awaiting
  // it really means "until the queue is empty" -- a second caller used to get
  // an instantly-resolved promise while the first drain was still running.
  const drainQueue = (): Promise<void> => {
    if (processingRef.current) return drainPromiseRef.current
    processingRef.current = true
    drainPromiseRef.current = (async () => {
      try {
        while (queueRef.current.length > 0) {
          await applyAnimated(queueRef.current.shift()!)
        }
      } finally {
        processingRef.current = false
      }
    })()
    return drainPromiseRef.current
  }

  const enqueueMoves = (moves: Move[]) => {
    queueRef.current.push(...moves)
    return drainQueue()
  }

  // Drop every turn still waiting, and the one being drawn. Anything that
  // replaces the cube (Reset, Scramble, a lesson position, leaving the screen)
  // calls this first, so no turn from before can land on the cube after.
  const flushQueue = () => {
    generationRef.current++
    queueRef.current = []
    handleAnimationComplete()
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => flushQueue(), [])

  const setBusyBoth = (on: boolean) => {
    busyRef.current = on
    setBusy(on)
  }

  return { animatingMove, busy, busyRef, setBusy: setBusyBoth, generationRef, handleAnimationComplete, drainQueue, enqueueMoves, flushQueue }
}
