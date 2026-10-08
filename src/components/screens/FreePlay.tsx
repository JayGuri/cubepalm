import { Alg } from 'cubing/alg'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useParams } from 'react-router-dom'
import { GuidePanel, HandsKey, SignsHud } from '../HandsGuide'
import { LessonPanel } from '../LessonPanel'
import { Logo } from '../Logo'
import { PuzzleCanvas } from '../PuzzleCanvas'
import { SolutionPlayer, type PlaybackSpeed } from '../SolutionPlayer'
import { BUTTON } from './play/buttonStyles'
import { CameraPanel } from './play/CameraPanel'
import { MovePad } from './play/MovePad'
import { PlayActions } from './play/PlayActions'
import { SolvedBurst } from './play/SolvedBurst'
import { MouseTips, TipsButton } from './play/PlayTips'
import { onPhone, useTips } from './play/useTips'
import { useGuideState } from './play/useGuideState'
import { useMoveQueue } from './play/useMoveQueue'
import { useSolveSession } from './play/useSolveSession'
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
import { createGuide, expandSteps, followMove, invertStep } from '../../core/solvers/solveGuide'
import { createGestureFeed, useHandGestures } from '../../core/gestures/useHandGestures'
import type { GestureEvent } from '../../core/gestures/GestureRecognizer'
import type { LandmarkFrame } from '../../core/gestures/landmarks'
import type { Move, PuzzleId } from '../../core/puzzles/PuzzlePlugin'
import { usePuzzleStore } from '../../state/puzzleStore'
import { getSolverError, getSolverStatus, quarterTurns, retrySolver, subscribeSolverStatus } from '../../core/solvers/kociemba'
import { useAcademyStore } from '../../state/academyStore'
import { TURN_MS, useSettingsStore } from '../../state/settingsStore'

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
  const baseTurnMs = TURN_MS[useSettingsStore((s) => s.turnSpeed)]
  const thresholds = DEFAULT_THRESHOLDS

  const [inputMode, setInputMode] = useState<InputMode>(defaultInputMode)
  // Hands mode always shows its gesture key until dismissed: there is no
  // other way for a first-time user to discover the vocabulary.
  const [showHandsHelp, setShowHandsHelp] = useState(!lessonId && !onPhone())
  const tips = useTips()
  // No keyboard to press R U F L D B on: offer the turns as buttons.
  const [touchScreen] = useState(() => window.matchMedia('(pointer: coarse)').matches)
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

  // Per camera frame: the fist lock and the sign recognizer, whose turns go
  // through the same animated move queue as every other input. All of it runs
  // outside React; state is only set when something on screen changes (the ring
  // around a held sign advances in a dozen steps, not twenty-five times a second).
  const [cameraFeed] = useState(createGestureFeed)
  const onFrame = (f: LandmarkFrame, events: GestureEvent[]) => {
    const lock = stepFistLock(fistLockRef.current, f, thresholds.fist)
    fistLockRef.current = lock.next
    if (lock.toggled) setCameraLocked((v) => !v)
    const hold = Math.round(fistLockProgress(lock.next, f.timestampMs) * 20) / 20
    setLockHoldProgress((prev) => (prev === hold ? prev : hold))

    const opts = { ...DEFAULT_SIGN_OPTIONS, swapHands }
    const r = stepSigns(signsRef.current, f, opts)
    signsRef.current = r.next
    for (const e of r.events) userMove(e.move)
    const held = activeSigns(r.next, f.timestampMs, opts).map((s) => ({ ...s, progress: Math.round(s.progress * 12) / 12 }))
    const key = held.map((s) => `${s.hand}${s.notation}${s.fired}${s.progress}`).join('|')
    if (key !== heldKeyRef.current) {
      heldKeyRef.current = key
      setHeldSigns(held)
    }

    // Only camera orbit/zoom reach the canvas, and orbit is held while a sign
    // is up -- a three-finger sign can read as an "open" hand, and holding it
    // must not drift the camera.
    const signUp = Boolean(r.next.hands.Left.current || r.next.hands.Right.current)
    const forCamera = events.filter((e) => e.type === 'ZOOM' || (e.type === 'ORBIT' && !signUp))
    if (forCamera.length > 0) cameraFeed.emit(f, forCamera)
  }
  const heldKeyRef = useRef('')
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame
  useEffect(() => {
    if (inputMode !== 'hands') return
    return gestures.feed.subscribe((f, events) => onFrameRef.current(f, events))
  }, [gestures.feed, inputMode])

  useEffect(() => {
    signsRef.current = createSignState()
    heldKeyRef.current = ''
    setHeldSigns([])
    setLockHoldProgress(0)
  }, [signsActive])

  // Every turn -- drag, gesture, key, scramble, solve -- waits in this one queue.
  const { animatingMove, busy, busyRef, setBusy: setBusyBoth, generationRef: queueGenRef, handleAnimationComplete, drainQueue, enqueueMoves, flushQueue } = useMoveQueue()
  const [queueError, setQueueError] = useState<string | null>(null)

  // --- Counters ------------------------------------------------------------
  const { scrambleLength, scrambleText, moveCount, assisted, timer, best, newBest, elapsed, startSession, countMove, markAssisted, checkFinish } =
    useSolveSession(puzzleId)

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

  const solverStatus = useSyncExternalStore(subscribeSolverStatus, getSolverStatus)

  // --- Guided solve ------------------------------------------------------
  // Opt-in via "Guide me"; it shows one quarter turn at a time. A first route
  // arrives within half a second, then a deeper search keeps looking for a
  // shorter one in the background and switches to it only if the cube has not
  // moved meanwhile. As the cube gets closer to solved that search can prove
  // the route is the shortest there is, and the guide says so.
  const {
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
    beginSearch,
    forgetSearch,
  } = useGuideState(lesson)
  const refineGuide = beginSearch

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

  // Stable identity, so the 3D canvas (which takes this as a prop) is not
  // re-rendered every time this screen is -- the timer alone ticks 5 times a second.
  const userMoveRef = useRef(userMove)
  userMoveRef.current = userMove
  const handleMove = useCallback((move: Move | null) => {
    if (move) userMoveRef.current(move)
  }, [])

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
      startSession(quarterTurns(moves), moves.map((m) => m.alg.toString()).join(' '))
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

  const showMouseTips = !lesson && inputMode === 'mouse' && tips.open && guideStatus === 'off' && solveStatus === 'off'

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
              {touchScreen ? 'Touch' : 'Mouse'}
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
            {/* The stage: a glow behind the cube and its shadow on the floor. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(42%_46%_at_50%_44%,rgba(76,201,240,0.10),transparent_70%),radial-gradient(30%_30%_at_62%_60%,rgba(255,213,0,0.06),transparent_70%)]"
            />
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-[calc(50%+min(33vw,25vh))] h-[6%] w-[min(60vw,26rem)] -translate-x-1/2 rounded-[50%] bg-black/55 blur-2xl" />
            <PuzzleCanvas
              plugin={plugin}
              state={state}
              onMove={handleMove}
              className="h-full w-full"
              gestureFeed={inputMode === 'hands' ? cameraFeed : null}
              colorblindPalette={colorblindPalette}
              colorRemap={lesson ? FLIP_COLORS : undefined}
              turnMs={solveStatus === 'ready' ? Math.round(baseTurnMs / speed) : baseTurnMs}
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

            {showMouseTips && <MouseTips onClose={tips.dismiss} mirror={plugin.id === 'mirror'} />}
            {!lesson && inputMode === 'mouse' && !tips.open && guideStatus === 'off' && solveStatus === 'off' && <TipsButton onClick={tips.show} />}

            {inputMode === 'hands' && (
              <CameraPanel videoRef={gestures.videoRef} feed={gestures.feed} tracker={gestures.tracker} ready={gestures.ready} error={gestures.error} signs={heldSigns.map((h) => h.notation)} />
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

            {/* A solve you made, or a lesson you finished: once, and briefly. */}
            {((timer.end !== null && solved) || lessonDone) && <SolvedBurst key={timer.end ?? 'lesson'} />}

            {guideStatus !== 'off' && (
              <GuidePanel
                guide={guide}
                status={guideStatus}
                onStop={stopGuide}
                showHands={inputMode === 'hands' || (Boolean(lesson) && !touchScreen)}
                touch={touchScreen && inputMode === 'mouse'}
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

          {touchScreen && inputMode === 'mouse' && (
            <MovePad disabled={busy} hint={guideStatus === 'following' && guide ? guide.steps[guide.index] : null} onTurn={(notation) => userMove({ alg: new Alg(notation), snapAngleDeg: plugin.snapAngleDeg })} />
          )}

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
          <PlayActions
            busy={busy}
            solved={solved}
            guideActive={guideStatus !== 'off'}
            solveActive={solveStatus !== 'off'}
            canUndo={moveHistory.length > 0}
            scrambleLength={scrambleLength}
            scrambleText={scrambleText}
            moveCount={moveCount}
            timer={timer}
            elapsed={elapsed}
            assisted={assisted}
            newBest={newBest}
            best={best}
            onScramble={() => void handleScramble()}
            onUndo={handleUndo}
            onReset={handleReset}
            onGuide={() => void startGuide()}
            onSolve={() => void handleSolve()}
          />
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
