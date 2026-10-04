import { useEffect, useRef, useState } from 'react'
import type { Move } from '../../../core/puzzles/PuzzlePlugin'
import { quarterTurns } from '../../../core/solvers/kociemba'
import { usePuzzleStore } from '../../../state/puzzleStore'

// Best unassisted solve on this device, per puzzle.
export interface BestResult {
  timeMs: number
  moves: number
}
const BEST_KEY = 'cubepalm.best.v1'

export function loadBest(puzzleId: string): BestResult | null {
  try {
    const all = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') as Record<string, BestResult>
    const b = all[puzzleId]
    return b && Number.isFinite(b.timeMs) && Number.isFinite(b.moves) ? b : null
  } catch {
    return null
  }
}

function saveBest(puzzleId: string, best: BestResult): void {
  try {
    const all = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') as Record<string, BestResult>
    localStorage.setItem(BEST_KEY, JSON.stringify({ ...all, [puzzleId]: best }))
  } catch {
    // Storage blocked: the best result just isn't remembered.
  }
}

/** 75000 -> "1:15". */
export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/**
 * What a scramble-and-solve attempt keeps track of. The scramble's own length is
 * shown on its own; the move counter starts at 0 and counts only turns made
 * after it (a half turn counts two, like the guide); the timer runs from the
 * first turn to the solve; and help from the guide or Solve for me marks the
 * attempt "assisted", which keeps it out of the best times.
 */
export function useSolveSession(puzzleId: string) {
  const [scrambleLength, setScrambleLength] = useState<number | null>(null)
  const [moveCount, setMoveCount] = useState(0)
  const [assisted, setAssisted] = useState(false)
  const [timer, setTimer] = useState<{ start: number | null; end: number | null }>({ start: null, end: null })
  const [clock, setClock] = useState(() => Date.now())
  const [best, setBest] = useState<BestResult | null>(() => loadBest(puzzleId))
  const [newBest, setNewBest] = useState(false)
  // The keyboard and sign handlers are created once, so they read this ref.
  const sessionRef = useRef({ scrambled: false, start: null as number | null, end: null as number | null, moves: 0, assisted: false })

  const startSession = (scrambleMoves: number | null) => {
    sessionRef.current = { scrambled: scrambleMoves !== null, start: null, end: null, moves: 0, assisted: false }
    setScrambleLength(scrambleMoves)
    setMoveCount(0)
    setAssisted(false)
    setTimer({ start: null, end: null })
    setNewBest(false)
  }

  const countMove = (move: Move, byUser: boolean) => {
    const session = sessionRef.current
    if (session.end !== null) return // already solved; the result stands
    session.moves += quarterTurns([move])
    setMoveCount(session.moves)
    if (!byUser) {
      session.assisted = true
      setAssisted(true)
    }
    if (session.scrambled && session.start === null) {
      session.start = Date.now()
      setTimer({ start: session.start, end: null })
    }
  }

  const markAssisted = () => {
    if (!sessionRef.current.scrambled) return
    sessionRef.current.assisted = true
    setAssisted(true)
  }

  // Called after turns land: stop the clock the moment a scrambled cube is solved.
  const checkFinish = () => {
    const session = sessionRef.current
    if (!session.scrambled || session.start === null || session.end !== null) return
    if (!usePuzzleStore.getState().isSolved()) return
    session.end = Date.now()
    setTimer({ start: session.start, end: session.end })
    if (!session.assisted) {
      const result = { timeMs: session.end - session.start, moves: session.moves }
      const previous = loadBest(puzzleId)
      const merged = {
        timeMs: Math.min(result.timeMs, previous?.timeMs ?? Infinity),
        moves: Math.min(result.moves, previous?.moves ?? Infinity),
      }
      setNewBest(!previous || result.timeMs < previous.timeMs || result.moves < previous.moves)
      saveBest(puzzleId, merged)
      setBest(merged)
    }
  }

  const running = timer.start !== null && timer.end === null
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setClock(Date.now()), 200)
    return () => window.clearInterval(id)
  }, [running])
  const elapsed = timer.start === null ? 0 : Math.max(0, (timer.end ?? clock) - timer.start)

  return { scrambleLength, moveCount, assisted, timer, best, newBest, elapsed, startSession, countMove, markAssisted, checkFinish }
}
