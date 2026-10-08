import { useEffect, useRef, useState } from 'react'
import type { Lesson } from '../../../core/academy/lessons'
import { releaseSolverPool } from '../../../core/solvers/kociemba'
import { expandSteps, type GuideState } from '../../../core/solvers/solveGuide'
import { usePuzzleStore } from '../../../state/puzzleStore'

/**
 * The guide's state, and the background search that keeps looking for a shorter
 * route for it.
 *
 * One search runs whenever the cube is at rest in a position worth solving. It
 * is started the moment a scramble lands, so if you ask for the guide or "Solve
 * for me" a few seconds later the route you get has already been refined; it
 * keeps going while you follow it. Every turn you make restarts it from the new
 * position, with the route you have left as the number to beat. It ends when
 * nothing shorter exists (the route is then proven the shortest possible) or
 * after about twelve seconds, and it pauses while the tab is hidden.
 *
 * Starting the guide and following the user's moves stay with the screen, since
 * they also drive the move queue and the counters.
 */
export function useGuideState(lesson: Lesson | undefined) {
  const [guide, setGuide] = useState<GuideState | null>(null)
  const [guideStatus, setGuideStatus] = useState<'off' | 'solving' | 'following' | 'done'>('off')
  const [guideOptimal, setGuideOptimal] = useState(false)
  const [guideRefining, setGuideRefining] = useState(false)
  const guideRef = useRef<GuideState | null>(null)
  const guideOptimalRef = useRef(false)
  // Bumped by anything that makes an answer still on its way out of date.
  const guideTokenRef = useRef(0)
  const refineRef = useRef<{ cancel: () => void } | null>(null)
  // The best route the search has found for the cube as it is after `length` turns.
  const foundRef = useRef<{ length: number; steps: string[]; optimal: boolean } | null>(null)

  const setGuideBoth = (g: GuideState | null) => {
    guideRef.current = g
    setGuide(g)
  }
  const setOptimalBoth = (optimal: boolean) => {
    guideOptimalRef.current = optimal
    setGuideOptimal(optimal)
  }

  const stopRefine = () => {
    refineRef.current?.cancel()
    refineRef.current = null
    setGuideRefining(false)
  }

  const stopGuide = () => {
    guideTokenRef.current++
    stopRefine()
    setGuideBoth(null)
    setGuideStatus('off')
    setOptimalBoth(false)
    setGuideRefining(false)
  }

  const beginSearch = () => {
    stopRefine()
    const { plugin: p, moveHistory: history } = usePuzzleStore.getState()
    if (lesson || !p || history.length === 0) return
    const token = guideTokenRef.current
    const g = guideRef.current
    // With a guide up, only a route shorter than the one being followed is wanted.
    const bound = g ? g.steps.length - g.index : Infinity
    if (guideOptimalRef.current || bound <= 1) return
    setGuideRefining(Boolean(g))
    const length = history.length
    const handle = p.refine(history, bound, (update) => {
      if (token !== guideTokenRef.current || refineRef.current !== handle) return
      if (update.moves) {
        const steps = expandSteps(update.moves)
        foundRef.current = { length, steps, optimal: false }
        const current = guideRef.current
        if (current && steps.length < current.steps.length - current.index) setGuideBoth({ steps, index: 0 })
      }
      if (update.done) {
        setGuideRefining(false)
        if (foundRef.current?.length === length) foundRef.current.optimal = update.optimal
        // Nothing cheaper than the route being followed exists: it is the shortest.
        if (guideRef.current) setOptimalBoth(update.optimal)
      }
    })
    refineRef.current = handle
  }

  // Drop the search and what it found: the cube has moved on.
  const forgetSearch = () => {
    stopRefine()
    foundRef.current = null
  }

  // The helper workers only exist while the screen is open.
  useEffect(() => () => releaseSolverPool(), [])

  // A hidden tab has nobody to show a shorter route to: stop searching, and
  // pick it up again when the tab comes back.
  useEffect(() => {
    const onVisibility = () => (document.hidden ? stopRefine() : beginSearch())
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    guide,
    guideStatus,
    setGuideStatus,
    guideOptimal,
    guideRefining,
    guideRef,
    guideOptimalRef,
    guideTokenRef,
    foundRef,
    setGuideBoth,
    setOptimalBoth,
    stopGuide,
    stopRefine,
    beginSearch,
    forgetSearch,
  }
}
