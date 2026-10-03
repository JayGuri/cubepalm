import { Alg } from 'cubing/alg'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CameraDebugOverlay } from '../CameraDebugOverlay'
import { GestureConfidenceIndicator } from '../GestureConfidenceIndicator'
import { GuidePanel, HandsKey, SignsHud } from '../HandsGuide'
import { LessonPanel } from '../LessonPanel'
import { Logo } from '../Logo'
import { PuzzleCanvas } from '../PuzzleCanvas'
import { SolutionPlayer, type PlaybackSpeed } from '../SolutionPlayer'
import { lessonById, lessonIndex } from '../../core/academy/lessons'
import { stageDone, stageProgress } from '../../core/academy/stages'
import { movesFromAlg } from '../../core/puzzles/cube3/logic'
import { createFistLockState, fistLockProgress, stepFistLock } from '../../core/gestures/fistLock'
import { DEFAULT_THRESHOLDS } from '../../core/gestures/GestureRecognizer'
import { moveFromKey } from '../../core/gestures/KeyboardAdapter'
import {
  activeSigns,
  createSignState,
  DEFAULT_SIGN_OPTIONS,
  LAYER_SLICE,
  stepSigns,
  type ActiveSign,
} from '../../core/gestures/signGestures'
import { createGuide, expandSteps, followMove, type GuideState } from '../../core/solvers/solveGuide'
import { useHandGestures } from '../../core/gestures/useHandGestures'
import type { Move, PuzzleId } from '../../core/puzzles/PuzzlePlugin'
import { usePuzzleStore } from '../../state/puzzleStore'
import { getSolverError, getSolverStatus, quarterTurns, releaseSolverPool, retrySolver, subscribeSolverStatus } from '../../core/solvers/kociemba'
import { useAcademyStore } from '../../state/academyStore'
import { useSettingsStore } from '../../state/settingsStore'

const BUTTON =
  'rounded-full border border-white/10 px-3 py-2 text-[0.8rem] sm:px-4 sm:text-sm font-medium text-[#ECEAE4] transition hover:border-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFD500] disabled:cursor-not-allowed disabled:opacity-40'
const PRIMARY =
  'rounded-full bg-[#FFD500] px-3.5 py-2 text-[0.8rem] sm:px-5 sm:text-sm font-semibold text-[#16171B] transition hover:bg-[#FFE04D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFD500] disabled:cursor-not-allowed disabled:opacity-40'

type InputMode = 'mouse' | 'hands'

// The Academy holds the cube with white at the bottom. That is the same cube
// turned over, so only the colours shown change: white and yellow trade
// places, and so do green and blue.
const FLIP_COLORS: Record<string, string> = {
  '#FFFFFF': '#FFD500',
  '#FFD500': '#FFFFFF',
  '#009E60': '#0051BA',
  '#0051BA': '#009E60',
}

export function FreePlay({ lessonId }: { lessonId?: string } = {}) {
  const { puzzleId: routePuzzleId = 'cube3' } = useParams<{ puzzleId: string }>()
  const lesson = lessonId ? lessonById(lessonId) : undefined
  const puzzleId = lesson ? 'cube3' : routePuzzleId
  const { plugin, state, moveHistory, status, error } = usePuzzleStore()
  const { load, applyMove, reset, undo, isSolved } = usePuzzleStore()
  const defaultInputMode = useSettingsStore((s) => s.defaultInputMode)
  const colorblindPalette = useSettingsStore((s) => s.colorblindPalette)
  const swapHands = useSettingsStore((s) => s.swapHands)
  const thresholds = DEFAULT_THRESHOLDS

  const [inputMode, setInputMode] = useState<InputMode>(defaultInputMode)
  // Hands mode always shows its gesture key until dismissed: there is no
  // other way for a first-time user to discover the vocabulary.
  const [showHandsHelp, setShowHandsHelp] = useState(!lessonId && !onPhone())
  // First-visit mouse tips; dismissal is remembered on this device.
  const [tipsOpen, setTipsOpen] = useState(() => {
    try {
      return localStorage.getItem(TIPS_KEY) !== 'dismissed' && !onPhone()
    } catch {
      return true
    }
  })
  const dismissTips = () => {
    setTipsOpen(false)
    try {
      localStorage.setItem(TIPS_KEY, 'dismissed')
    } catch {
      // Storage blocked: the tips simply come back next visit.
    }
  }
  // One lock for every input: the header button, Space, or a held fist.
  const [cameraLocked, setCameraLocked] = useState(false)
  const toggleCameraLock = () => setCameraLocked((v) => !v)

  useEffect(() => {
    void load(puzzleId as PuzzleId)
  }, [load, puzzleId])

  // Mouse and keyboard must keep working while the camera is active (spec 8.6),
  // so the hook only runs at all when the user has switched to hand control.
  const gestures = useHandGestures({ enabled: inputMode === 'hands', thresholds })

  const solved = status === 'ready' && isSolved()

  const fistLockRef = useRef(createFistLockState())
  const [lockHoldProgress, setLockHoldProgress] = useState(0)
  const signsRef = useRef(createSignState())
  const [heldSigns, setHeldSigns] = useState<ActiveSign[]>([])
  const signsActive = inputMode === 'hands'

  // Per camera frame: the fist lock (every gesture style) and, in Signs
  // mode, the sign recognizer, whose turns go through the same animated
  // move queue as every other input.
  useEffect(() => {
    const f = gestures.frame
    if (inputMode !== 'hands' || !f) return
    const lock = stepFistLock(fistLockRef.current, f, thresholds.fist)
    fistLockRef.current = lock.next
    if (lock.toggled) setCameraLocked((v) => !v)
    setLockHoldProgress(fistLockProgress(lock.next, f.timestampMs))

    if (!signsActive) return
    const opts = { ...DEFAULT_SIGN_OPTIONS, swapHands }
    const r = stepSigns(signsRef.current, f, opts)
    signsRef.current = r.next
    for (const e of r.events) userMove(e.move)
    setHeldSigns(activeSigns(r.next, f.timestampMs, opts))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gestures.frame, inputMode, signsActive, swapHands])

  useEffect(() => {
    signsRef.current = createSignState()
    setHeldSigns([])
  }, [signsActive])

  // Only camera orbit/zoom pass through to the canvas, and orbit is held while a sign is up -- a three-finger
  // sign can read as an "open" hand, and holding it must not drift the
  // camera.
  const canvasTick = useMemo(() => {
    const tick = gestures.tick
    if (inputMode !== 'hands' || !tick) return null
    const events = tick.events.filter(
      (e) =>
        e.type === 'ZOOM' ||
        (e.type === 'ORBIT' && !signsRef.current.hands.Left.current && !signsRef.current.hands.Right.current),
    )
    return { ...tick, events }
  }, [gestures.tick, inputMode])

  // Moves used to apply (and jump to their final colours) the instant they
  // arrived, which read as jerky teleporting rather than a cube turning --
  // confirmed by a user report, and by there being no animation code at all.
  // Every move (drag, gesture, keyboard, scramble, solve) now goes through
  // this one queue: applied to the store immediately (so game logic/solvers
  // keep seeing up-to-date state), but PuzzleCanvas is told which move is
  // "in flight" and keeps rendering its pre-move colours, rotating the
  // affected layer into place, until it reports the animation done -- only
  // then does the next queued move start. Solve and Scramble push their
  // whole move list through the same queue instead of applying it in one
  // batch, which is what makes Solve visibly solve move by move.
  const [animatingMove, setAnimatingMove] = useState<Move | null>(null)
  const [busy, setBusy] = useState(false)
  const [queueError, setQueueError] = useState<string | null>(null)
  const animResolveRef = useRef<(() => void) | null>(null)
  const moveQueueRef = useRef<Move[]>([])
  const processingRef = useRef(false)

  const animTimerRef = useRef<number | undefined>(undefined)

  // The turn in flight is over, however it ended: the canvas finished drawing
  // it, the watchdog below gave up on it, or the queue was flushed under it.
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

  // Drop every turn still waiting, and the one being drawn. Anything that
  // replaces the cube (Reset, Scramble, a lesson position, leaving the screen)
  // calls this first, so no turn from before can land on the cube after. The
  // generation lets an operation that was mid-await see that it was overtaken.
  const queueGenRef = useRef(0)
  const flushQueue = () => {
    queueGenRef.current++
    moveQueueRef.current = []
    handleAnimationComplete()
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => flushQueue(), [])
  // The key and sign handlers are created once, so they read busy from a ref.
  const busyRef = useRef(false)
  const setBusyBoth = (on: boolean) => {
    busyRef.current = on
    setBusy(on)
  }

  // Every caller gets the SAME promise for the drain in progress, so awaiting
  // it really means "until the queue is empty" -- a second caller used to get
  // an instantly-resolved promise while the first drain was still running.
  const drainPromiseRef = useRef<Promise<void>>(Promise.resolve())
  const drainQueue = (): Promise<void> => {
    if (processingRef.current) return drainPromiseRef.current
    processingRef.current = true
    drainPromiseRef.current = (async () => {
      try {
        while (moveQueueRef.current.length > 0) {
          const move = moveQueueRef.current.shift()!
          await applyAnimated(move)
        }
      } finally {
        processingRef.current = false
      }
    })()
    return drainPromiseRef.current
  }

  const enqueueMoves = (moves: Move[]) => {
    moveQueueRef.current.push(...moves)
    return drainQueue()
  }

  // --- Counters ------------------------------------------------------------
  // The scramble's own length is shown on its own. The move counter starts at
  // 0 and counts only turns made after it (a half turn counts two, like the
  // guide), and the timer runs from the first turn to the solve.
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

  // --- Solution playback ----------------------------------------------------
  // "Solve for me" finds a solution, then plays it back where it can be paused,
  // stepped through either way and sped up.
  const [solution, setSolution] = useState<{ moves: Move[]; index: number } | null>(null)
  const solutionRef = useRef<{ moves: Move[]; index: number } | null>(null)
  const [solveStatus, setSolveStatus] = useState<'off' | 'solving' | 'ready'>('off')
  const solveTokenRef = useRef(0)
  const solveActiveRef = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [solutionOptimal, setSolutionOptimal] = useState(false)
  const setSolutionBoth = (next: { moves: Move[]; index: number } | null) => {
    solutionRef.current = next
    setSolution(next)
  }

  const closeSolution = () => {
    solveTokenRef.current++
    solveActiveRef.current = false
    setPlaying(false)
    setSolutionBoth(null)
    setSolveStatus('off')
  }

  useEffect(() => {
    if (!playing) return
    let alive = true
    void (async () => {
      await drainQueue()
      if (!alive) return
      const s = solutionRef.current
      if (!s || s.index >= s.moves.length) {
        setPlaying(false)
        return
      }
      // Count the move first, then play it: pausing at any instant leaves the
      // index and the cube in agreement.
      setSolutionBoth({ ...s, index: s.index + 1 })
      countMove(s.moves[s.index], false)
      void enqueueMoves([s.moves[s.index]]).then(checkFinish)
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, solution?.index])

  const stepSolution = (direction: 1 | -1) => {
    const s = solutionRef.current
    if (!s || playing) return
    if (direction === 1 && s.index < s.moves.length) {
      setSolutionBoth({ ...s, index: s.index + 1 })
      countMove(s.moves[s.index], false)
      void enqueueMoves([s.moves[s.index]]).then(checkFinish)
    } else if (direction === -1 && s.index > 0) {
      const m = s.moves[s.index - 1]
      const back = { alg: m.alg.invert(), snapAngleDeg: m.snapAngleDeg }
      setSolutionBoth({ ...s, index: s.index - 1 })
      countMove(back, false)
      void enqueueMoves([back])
    }
  }

  // --- Academy lessons ---------------------------------------------------------
  const completeLesson = useAcademyStore((s) => s.complete)
  const [caseIndex, setCaseIndex] = useState(0)
  const [lessonNote, setLessonNote] = useState<string | null>(null)
  const [lessonDone, setLessonDone] = useState(false)

  // Put the cube in a lesson's practice position (not animated).
  const setupCase = (i: number) => {
    if (!lesson) return
    stopGuide()
    setLessonNote(null)
    setLessonDone(false)
    flushQueue()
    reset()
    const c = lesson.cases[i]
    if (c) for (const m of movesFromAlg(new Alg(c.setup))) applyMove(m)
    setCaseIndex(i)
  }

  const checkLesson = () => {
    if (!lesson) return
    const { state: now, moveHistory: history } = usePuzzleStore.getState()
    if (!now) return
    const met = lesson.goal ? stageDone(lesson.goal, now) : history.length >= 4
    if (met) {
      setLessonDone(true)
      completeLesson(lesson.id)
    }
  }

  useEffect(() => {
    if (lesson && status === 'ready') setupCase(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id, plugin, status])

  // The numbers behind the lesson's progress bar: how many pieces are right.
  const lessonProgress =
    lesson && state
      ? lesson.goal
        ? stageProgress(lesson.goal, state)
        : { done: Math.min(moveHistory.length, 4), total: 4, unit: 'turns made' }
      : { done: 0, total: 1, unit: '' }

  // Play the whole practice solution as a demo, with the usual player controls.
  const watchIt = () => {
    const c = lesson?.cases[caseIndex]
    if (!lesson || !c) return
    closeSolution()
    setupCase(caseIndex)
    solveActiveRef.current = true
    setSolutionBoth({ moves: movesFromAlg(new Alg(c.solution)), index: 0 })
    setSolveStatus('ready')
    setPlaying(true)
  }

  const showMe = () => {
    const c = lesson?.cases[caseIndex]
    if (!lesson || !c) return
    setupCase(caseIndex)
    setGuideBoth(createGuide(movesFromAlg(new Alg(c.solution))))
    setGuideStatus('following')
  }

  // The helper workers only exist while this screen is open.
  useEffect(() => () => releaseSolverPool(), [])

  const solverStatus = useSyncExternalStore(subscribeSolverStatus, getSolverStatus)

  // A hidden tab has nobody to show a shorter route to: stop searching, and
  // pick it up again when the tab comes back.
  useEffect(() => {
    const onVisibility = () => (document.hidden ? stopRefine() : beginSearch())
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Guided solve ------------------------------------------------------
  // Opt-in via "Guide me"; it shows one quarter turn at a time. A first route
  // arrives within half a second, then a deeper search keeps looking for a
  // shorter one in the background and switches to it only if the cube has not
  // moved meanwhile. As the cube gets closer to solved that search can prove
  // the route is the shortest there is, and the guide says so.
  const [guide, setGuide] = useState<GuideState | null>(null)
  const [guideStatus, setGuideStatus] = useState<'off' | 'solving' | 'following' | 'done'>('off')
  const [guideOptimal, setGuideOptimal] = useState(false)
  const [guideRefining, setGuideRefining] = useState(false)
  const guideRef = useRef<GuideState | null>(null)
  const guideOptimalRef = useRef(false)
  const guideTokenRef = useRef(0)
  const setGuideBoth = (g: GuideState | null) => {
    guideRef.current = g
    setGuide(g)
  }
  const setOptimalBoth = (optimal: boolean) => {
    guideOptimalRef.current = optimal
    setGuideOptimal(optimal)
  }

  const stopGuide = () => {
    guideTokenRef.current++
    stopRefine()
    setGuideBoth(null)
    setGuideStatus('off')
    setOptimalBoth(false)
    setGuideRefining(false)
  }

  // One search runs in the background whenever the cube is at rest in a
  // position worth solving. It is started the moment a scramble lands, so if you
  // ask for the guide or "Solve for me" a few seconds later the route you get
  // has already been refined; it keeps going while you follow it. Every turn you
  // make restarts it from the new position, with the route you have left as the
  // number to beat. It ends when nothing shorter exists (the route is then
  // proven the shortest possible) or after 90 seconds.
  const refineRef = useRef<{ cancel: () => void } | null>(null)
  // The best route the search has found for the cube as it is after `length` turns.
  const foundRef = useRef<{ length: number; steps: string[]; optimal: boolean } | null>(null)
  const stopRefine = () => {
    refineRef.current?.cancel()
    refineRef.current = null
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
  const refineGuide = beginSearch
  // Drop the search and what it found: the cube has moved on.
  const forgetSearch = () => {
    stopRefine()
    foundRef.current = null
  }

  const startGuide = async () => {
    const p = usePuzzleStore.getState().plugin
    if (!p) return
    const token = ++guideTokenRef.current
    setGuideStatus('solving')
    setOptimalBoth(false)
    markAssisted()
    // Wait for any queued turns to land so the solver sees the real position.
    await drainQueue()
    if (token !== guideTokenRef.current) return // stopped, or the cube was replaced, while turns landed
    const { state: now, moveHistory: history } = usePuzzleStore.getState()
    if (!now) {
      stopGuide()
      return
    }
    try {
      const first = await p.solve(now, history, 'quick')
      if (token !== guideTokenRef.current) return // superseded by a newer move or stop
      // A route found while the cube sat still may already beat the quick one.
      const ready = foundRef.current?.length === history.length ? foundRef.current : null
      const steps = ready && ready.steps.length < expandSteps(first.moves).length ? ready.steps : expandSteps(first.moves)
      const g = { steps, index: 0 }
      const proven = first.optimal || Boolean(ready?.optimal && ready.steps.length === steps.length)
      setGuideBoth(g.steps.length ? g : null)
      setGuideStatus(g.steps.length ? 'following' : 'done')
      setOptimalBoth(proven)
      if (g.steps.length && !proven) refineGuide()
    } catch (e) {
      if (token === guideTokenRef.current) {
        setQueueError((e as Error).message)
        stopGuide()
      }
    }
  }

  // Every move the USER makes -- sign, key, drag -- comes through here.
  // (Scramble and Solve feed the queue directly: they aren't the user's.)
  const userMove = (move: Move) => {
    // A scramble is being dealt: a turn now would be buried in the middle of it.
    if (busyRef.current) return
    if (solveActiveRef.current) closeSolution()
    countMove(move, true)
    void enqueueMoves([move]).then(() => {
      checkLesson()
      checkFinish()
    })
    let g = guideRef.current
    if (!g) {
      forgetSearch()
      return
    }
    for (const step of expandSteps([move])) {
      const r = followMove(g, step)
      if (r.outcome === 'off-track') {
        if (lesson) {
          // A lesson's moves are fixed; there is nothing to re-solve.
          stopGuide()
          setLessonNote('That was not the move shown. Press Undo to take it back, then Show me again.')
          return
        }
        // Instant recovery: undo the stray turn, then carry on with the rest of
        // the route. The background search still looks for something shorter.
        setGuideBoth({ steps: [invertStep(step), ...g.steps.slice(g.index)], index: 0 })
        setOptimalBoth(false)
        refineGuide()
        return
      }
      g = r.guide
      if (r.outcome === 'finished') {
        if (lesson) {
          stopGuide()
          return
        }
        // Don't announce "Solved!" while queued turns are still animating --
        // wait for the cube to actually land, and only celebrate if it really
        // is solved; otherwise keep guiding from wherever it ended up.
        const token = ++guideTokenRef.current
        setGuideBoth(null)
        setGuideStatus('solving')
        void drainQueue().then(() => {
          if (token !== guideTokenRef.current) return
          if (usePuzzleStore.getState().isSolved()) setGuideStatus('done')
          else void startGuide()
        })
        return
      }
    }
    setGuideBoth(g)
    // Closer to solved, the search may now be able to prove the route optimal.
    if (!guideOptimalRef.current) refineGuide()
  }

  const handleMove = (move: Move | null) => {
    if (move) userMove(move)
  }

  const handleScramble = async () => {
    if (!plugin) return
    stopGuide()
    closeSolution()
    setBusyBoth(true)
    setQueueError(null)
    try {
      flushQueue()
      reset()
      forgetSearch()
      const gen = queueGenRef.current
      const moves = await plugin.scramble()
      if (gen !== queueGenRef.current) return // the cube was replaced while the scramble was being drawn up
      startSession(quarterTurns(moves))
      await enqueueMoves(moves)
      if (gen === queueGenRef.current) beginSearch()
    } catch (e) {
      setQueueError((e as Error).message)
    } finally {
      setBusyBoth(false)
    }
    // No guide here on purpose: after a scramble the user solves it
    // themselves by default, and opts in with "Guide me" if they want help.
  }

  const handleReset = () => {
    stopGuide()
    closeSolution()
    // Drop turns still waiting to animate, or they would land on the reset cube.
    flushQueue()
    reset()
    startSession(null)
    forgetSearch()
  }

  const handleUndo = () => {
    closeSolution()
    setLessonNote(null)
    const last = usePuzzleStore.getState().moveHistory.at(-1)
    undo()
    if (last) {
      countMove(last, true)
      checkFinish()
    }
    const g = guideRef.current
    if (!g) forgetSearch()
    if (!g || lesson || !last) return
    const taken = last.alg.toString()
    if (g.index > 0 && g.steps[g.index - 1] === taken) {
      // Undid the step just taken: show it again.
      setGuideBoth({ ...g, index: g.index - 1 })
    } else if (g.steps[g.index] === invertStep(taken)) {
      // Undid a stray turn, which was exactly the recovery step: move on.
      setGuideBoth({ ...g, index: g.index + 1 })
    } else {
      void startGuide()
    }
  }

  const handleSolve = async () => {
    if (!plugin || !state) return
    stopGuide()
    closeSolution()
    const token = solveTokenRef.current
    solveActiveRef.current = true
    markAssisted()
    setSolveStatus('solving')
    setQueueError(null)
    try {
      await drainQueue()
      const { state: now, moveHistory: history } = usePuzzleStore.getState()
      const solved = await plugin.solve(now!, history, 'normal')
      if (token !== solveTokenRef.current) return // stopped or superseded while thinking
      // The background search may have found something shorter while the cube sat still.
      const ready = foundRef.current?.length === history.length ? foundRef.current : null
      const better = ready && ready.steps.length < expandSteps(solved.moves).length
      const moves = better ? movesFromAlg(new Alg(ready.steps.join(' '))) : solved.moves
      const optimal = better ? ready.optimal : solved.optimal
      setSolutionOptimal(optimal)
      if (moves.length === 0) {
        closeSolution()
        return
      }
      setSolutionBoth({ moves, index: 0 })
      setSolveStatus('ready')
      setPlaying(true)
    } catch (e) {
      if (token === solveTokenRef.current) {
        setQueueError((e as Error).message)
        closeSolution()
      }
    }
  }

  // Task 10.2: keyboard stays live regardless of inputMode (spec 8.6) --
  // never the ONLY path, but never disabled either.
  useEffect(() => {
    if (status !== 'ready' || !plugin) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) return
      if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        setCameraLocked((v) => !v)
        return
      }
      const move = moveFromKey({ key: e.key, shiftKey: e.shiftKey, altKey: e.altKey }, plugin.snapAngleDeg)
      if (!move) return
      e.preventDefault()
      userMove(move)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, plugin])

  const showMouseTips = !lesson && inputMode === 'mouse' && tipsOpen && guideStatus === 'off' && solveStatus === 'off'

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#16171B] text-[#ECEAE4]">
      <header className="flex shrink-0 items-center gap-3 border-b border-white/[0.07] px-4 py-3.5 sm:px-6">
        <Logo size={34} iconOnlyOnPhone />
        <div className="flex min-w-0 items-center gap-3 max-sm:sr-only">
        <span className="text-white/20" aria-hidden>
          /
        </span>
        {lesson ? (
          <>
            <Link to="/learn" className="text-sm text-[#9C9AA3] hover:text-[#ECEAE4]">
              Learn
            </Link>
            <span className="text-white/20" aria-hidden>
              /
            </span>
            <span className="text-sm text-[#9C9AA3]">{lesson.title}</span>
          </>
        ) : (
          <h1 className="text-sm text-[#9C9AA3]">{plugin?.displayName ?? puzzleId}</h1>
        )}
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div role="group" aria-label="Control with" className="flex rounded-full bg-[#202227] p-1 text-sm">
            <button
              type="button"
              data-testid="input-mode-mouse"
              aria-pressed={inputMode === 'mouse'}
              onClick={() => setInputMode('mouse')}
              className={`rounded-full px-3.5 py-1 transition ${inputMode === 'mouse' ? 'bg-[#FFD500] font-semibold text-[#16171B]' : 'text-[#9C9AA3] hover:text-[#ECEAE4]'}`}
            >
              Mouse
            </button>
            <button
              type="button"
              data-testid="input-mode-hands"
              aria-pressed={inputMode === 'hands'}
              onClick={() => setInputMode('hands')}
              className={`rounded-full px-3.5 py-1 transition ${inputMode === 'hands' ? 'bg-[#FFD500] font-semibold text-[#16171B]' : 'text-[#9C9AA3] hover:text-[#ECEAE4]'}`}
            >
              Hands
            </button>
          </div>
          <button
            type="button"
            data-testid="camera-lock"
            aria-pressed={cameraLocked}
            onClick={toggleCameraLock}
            title="Freeze the view so the cube stays put (Space, or hold a fist)"
            className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition ${
              cameraLocked
                ? 'border-[#F5B83D] bg-[#F5B83D]/15 text-[#F5B83D]'
                : 'border-white/10 text-[#9C9AA3] hover:border-white/25 hover:text-[#ECEAE4]'
            }`}
          >
            {cameraLocked ? 'View locked' : 'Lock view'}
          </button>
        </div>
      </header>

      {status === 'loading' && <p className="p-6 text-[#9C9AA3]">Loading the cube…</p>}
      {status === 'error' && <p className="p-6 text-[#EF4444]">{error}</p>}

      {status === 'ready' && plugin && state && (
        <>
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {lesson && (
            <LessonPanel
              lesson={lesson}
              index={lessonIndex(lesson.id)}
              caseNumber={caseIndex + 1}
              done={lessonDone}
              note={lessonNote}
              guiding={guideStatus !== 'off'}
              watching={solveStatus !== 'off'}
              progress={lessonProgress}
              signMoves={lesson.algorithm?.moves ?? lesson.cases[caseIndex]?.solution ?? ''}
              onWatch={watchIt}
              onGuide={showMe}
              onSelectCase={setupCase}
            />
          )}
          <div className="relative min-h-0 w-full flex-1">
            <PuzzleCanvas
              plugin={plugin}
              state={state}
              onMove={handleMove}
              className="h-full w-full"
              gestureTick={canvasTick}
              colorblindPalette={colorblindPalette}
              colorRemap={lesson ? FLIP_COLORS : undefined}
              turnMs={solveStatus === 'ready' ? Math.round(220 / speed) : undefined}
              animatingMove={animatingMove}
              onAnimationComplete={handleAnimationComplete}
              cameraLocked={cameraLocked}
              previewLayer={signsActive && heldSigns[0] ? LAYER_SLICE[heldSigns[0].layer] : null}
              guideMove={guide ? guide.steps[guide.index] : null}
            />

            {(cameraLocked || lockHoldProgress > 0) && (
              <div
                data-testid="lock-badge"
                className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-[#F5B83D]/40 bg-[#16171B]/90 px-3 py-1 text-sm text-[#F5B83D]"
              >
                {lockHoldProgress > 0 && (
                  <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden>
                    <circle cx="10" cy="10" r="8" fill="none" stroke="#F5B83D33" strokeWidth="3" />
                    <circle
                      cx="10"
                      cy="10"
                      r="8"
                      fill="none"
                      stroke="#F5B83D"
                      strokeWidth="3"
                      strokeDasharray={`${lockHoldProgress * 50.3} 50.3`}
                      transform="rotate(-90 10 10)"
                    />
                  </svg>
                )}
                {lockHoldProgress > 0 ? (cameraLocked ? 'Keep holding to unlock…' : 'Keep holding to lock…') : 'View locked'}
              </div>
            )}

            {showMouseTips && <MouseTips onClose={dismissTips} mirror={plugin.id === 'mirror'} />}

            {inputMode === 'hands' && (
              <div className="absolute right-3 top-3 w-32 overflow-hidden rounded-xl border border-white/10 bg-[#202227] shadow-lg sm:right-4 sm:top-4 sm:w-64">
                <div className="relative aspect-video bg-black">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    ref={gestures.videoRef}
                    className="h-full w-full -scale-x-100 object-cover"
                    playsInline
                    muted
                    data-testid="gesture-video"
                  />
                  <CameraDebugOverlay frame={gestures.frame} width={256} height={144} />
                </div>
                <div className="flex items-center justify-between px-2.5 py-1.5">
                  <GestureConfidenceIndicator frame={gestures.frame} />
                  <span className="shrink-0 text-xs text-[#9C9AA3]" data-testid="gesture-state">
                    {heldSigns.length ? heldSigns.map((h) => h.notation).join(' + ') : 'Show a sign'}
                  </span>
                </div>
                {gestures.error && (
                  <p className="bg-[#EF4444]/15 px-2.5 py-1.5 text-xs text-[#EF4444]" data-testid="gesture-error">
                    {gestures.error}
                  </p>
                )}
              </div>
            )}

            {inputMode === 'hands' && showHandsHelp && <HandsKey onClose={() => setShowHandsHelp(false)} />}
            {inputMode === 'hands' && !showHandsHelp && (
              <button
                type="button"
                onClick={() => setShowHandsHelp(true)}
                className="absolute left-4 top-4 rounded-full border border-white/10 bg-[#202227] px-3.5 py-1.5 text-sm text-[#9C9AA3] hover:text-[#ECEAE4]"
              >
                Show hand signs
              </button>
            )}

            {signsActive && heldSigns.length > 0 && <SignsHud signs={heldSigns} />}

            {guideStatus !== 'off' && (
              <GuidePanel
                guide={guide}
                status={guideStatus}
                onStop={stopGuide}
                showHands={inputMode === 'hands' || Boolean(lesson)}
                optimal={guideOptimal}
                refining={guideRefining}
              />
            )}

            {solveStatus !== 'off' && (
              <SolutionPlayer
                status={solveStatus}
                moves={solution?.moves.map((m) => m.alg.toString()) ?? []}
                index={solution?.index ?? 0}
                playing={playing}
                speed={speed}
                steps={solution ? expandSteps(solution.moves).length : 0}
                optimal={solutionOptimal && !lesson}
                onPlayPause={() => setPlaying((v) => !v)}
                onStep={stepSolution}
                onSpeed={setSpeed}
                onClose={closeSolution}
              />
            )}
          </div>
          </div>

          {lesson ? (
            <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-white/[0.07] px-4 py-3 sm:gap-3 sm:px-6">
              <button type="button" className={BUTTON} onClick={handleUndo} disabled={busy || moveHistory.length === 0}>
                Undo
              </button>
              <button type="button" className={BUTTON} onClick={() => setupCase(caseIndex)} disabled={busy}>
                Restart position
              </button>
              <div className="mx-auto flex items-center gap-3 text-sm">
                <span
                  data-testid="lesson-status"
                  className={`rounded-full px-3 py-1 font-semibold ${lessonDone ? 'bg-[#2FB36B]/15 text-[#4ED48A]' : 'bg-white/5 text-[#9C9AA3]'}`}
                >
                  {lessonDone ? 'Complete' : 'In progress'}
                </span>
                <span className="tabular-nums text-[#9C9AA3]" data-testid="move-count">
                  {moveHistory.length} moves
                </span>
              </div>
              <Link to="/learn" className={BUTTON}>
                All lessons
              </Link>
            </footer>
          ) : (
          <footer className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-white/[0.07] px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
            <button type="button" className={PRIMARY} onClick={() => void handleScramble()} disabled={busy}>
              Scramble
            </button>
            <button type="button" className={BUTTON} onClick={handleUndo} disabled={busy || moveHistory.length === 0}>
              Undo
            </button>
            <button type="button" className={BUTTON} onClick={handleReset} disabled={busy}>
              Reset
            </button>

            <div className="order-first flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 pb-1 text-xs sm:order-none sm:mx-auto sm:w-auto sm:pb-0 sm:text-sm">
              <span
                data-testid="solved-status"
                className={`rounded-full px-3 py-1 font-semibold ${
                  solved ? 'bg-[#2FB36B]/15 text-[#4ED48A]' : 'bg-white/5 text-[#9C9AA3]'
                }`}
              >
                {solved ? 'Solved' : 'Scrambled'}
              </span>
              {scrambleLength !== null && (
                <span className="text-[#9C9AA3]" data-testid="scramble-length" title="Turns used to scramble the cube, counted the same way as your moves: a half turn counts two">
                  Scramble: {scrambleLength}
                </span>
              )}
              <span className="tabular-nums text-[#ECEAE4]" data-testid="move-count" title="Turns since the scramble; a half turn counts two">
                {moveCount} moves
              </span>
              {timer.start !== null && (
                <span className="tabular-nums text-[#ECEAE4]" data-testid="solve-timer">
                  {formatTime(elapsed)}
                </span>
              )}
              {timer.end !== null && (
                <span data-testid="solve-summary" className={assisted ? 'text-[#9C9AA3]' : 'font-semibold text-[#FFD500]'}>
                  {assisted ? 'with help' : newBest ? 'New best!' : best ? `Best ${formatTime(best.timeMs)}` : ''}
                </span>
              )}
            </div>

            {!solved && guideStatus === 'off' && (
              <button
                type="button"
                data-testid="guide-me"
                title="Shows the next move to make, one step at a time"
                className={`${BUTTON} border-[#F5B83D]/60 text-[#F5B83D] hover:border-[#F5B83D]`}
                onClick={() => void startGuide()}
                disabled={busy}
              >
                Guide me
              </button>
            )}
            <button
              type="button"
              className={BUTTON}
              title="Plays the whole solution for you"
              onClick={() => void handleSolve()}
              disabled={busy || solved || solveStatus !== 'off'}
            >
              Solve for me
            </button>
          </footer>
          )}

          {(error || queueError) && <p className="px-6 pb-3 text-sm text-[#EF4444]">{error || queueError}</p>}
          {solverStatus === 'failed' && (
            <p className="flex flex-wrap items-center gap-3 px-6 pb-3 text-sm text-[#F5B83D]" data-testid="solver-failed">
              The solver could not start, so Scramble, Guide me and Solve for me are off. You can still turn the cube.
              <button type="button" className={BUTTON} onClick={() => void retrySolver().catch(() => undefined)} title={getSolverError() ?? undefined}>
                Try again
              </button>
            </p>
          )}
        </>
      )}
    </main>
  )
}

// Far longer than any turn takes to draw (220 ms at normal speed).
const ANIMATION_WATCHDOG_MS = 3000

const TIPS_KEY = 'palmtwist.tips.v1'

/** A phone-sized screen, where the cube needs the room more than the tips do. */
function onPhone(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
}

function MouseTips({ onClose, mirror }: { onClose: () => void; mirror: boolean }) {
  return (
    <div
      data-testid="mouse-tips"
      className="absolute left-4 top-4 w-[calc(100%-2rem)] rounded-xl border border-white/10 bg-[#202227]/95 p-4 text-sm text-[#9C9AA3] shadow-lg sm:w-72"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h2 className="font-display text-base font-bold text-[#ECEAE4]">How to turn the cube</h2>
        <button type="button" onClick={onClose} aria-label="Hide tips" className="text-lg leading-none hover:text-[#ECEAE4]">
          ×
        </button>
      </div>
      <ul className="space-y-1.5">
        {mirror && (
          <li>
            <b className="text-[#ECEAE4]">Solved</b> when the blocks form a perfect cube again. The thick blocks belong on
            the Right, Top and Front.
          </li>
        )}
        <li>
          <b className="text-[#ECEAE4]">Drag a {mirror ? 'block' : 'piece'}</b> to turn its layer.
        </li>
        <li>
          <b className="text-[#ECEAE4]">Drag empty space</b> or right-drag to look around; scroll to zoom.
        </li>
        <li className="max-sm:hidden">
          Or press <Kbd>R</Kbd> <Kbd>U</Kbd> <Kbd>F</Kbd> <Kbd>L</Kbd> <Kbd>D</Kbd> <Kbd>B</Kbd>, with <Kbd>Shift</Kbd> to
          turn the other way.
        </li>
        <li className="max-sm:hidden">
          <Kbd>Space</Kbd> locks the view.
        </li>
      </ul>
      <p className="mt-3 border-t border-white/10 pt-3 max-sm:hidden">
        Press <b className="text-[#ECEAE4]">Scramble</b> and solve it yourself. Stuck?{' '}
        <b className="text-[#F5B83D]">Guide me</b> shows the next move.
      </p>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 font-sans text-xs text-[#ECEAE4]">{children}</kbd>
}

/** "R" <-> "R'" (quarter turns only, as the guide shows them). */
const invertStep = (step: string) => (step.endsWith("'") ? step.slice(0, -1) : `${step}'`)

/** 75000 -> "1:15". */
function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

// Best unassisted solve on this device, per puzzle.
interface BestResult {
  timeMs: number
  moves: number
}
const BEST_KEY = 'palmtwist.best.v1'

function loadBest(puzzleId: string): BestResult | null {
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
