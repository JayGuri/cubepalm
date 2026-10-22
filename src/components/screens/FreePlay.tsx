import { Alg } from 'cubing/alg'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useParams } from 'react-router-dom'
import { GuidePanel, HandsKey, SignsHud } from '../HandsGuide'
import { LessonPanel } from '../LessonPanel'
import { PuzzleCanvas } from '../PuzzleCanvas'
import { SolutionPlayer, type PlaybackSpeed } from '../SolutionPlayer'
import { BUTTON, KEY_SURFACE, STICKER, WELL } from './play/buttonStyles'
import { CameraPanel } from './play/CameraPanel'
import { FaceGlyph } from './play/FaceGlyph'
import { LockBadge, PlayHeader, type InputMode } from './play/PlayHeader'
import { MovePad } from './play/MovePad'
import { ScrambleDialog } from './play/ScrambleDialog'
import { PlayActions } from './play/PlayActions'
import { SolvedBurst } from './play/SolvedBurst'
import { MouseTips, TipsButton } from './play/PlayTips'
import { onPhone, useTips } from './play/useTips'
import { useGuideState } from './play/useGuideState'
import { useMoveQueue } from './play/useMoveQueue'
import { useSolveSession } from './play/useSolveSession'
import { lessonById, lessonIndex } from '../../core/academy/lessons'
import { stageDone, stageProgress } from '../../core/academy/stages'
import { practicePosition } from '../../core/academy/teach/practice'
import { teachSolve, type TeachStep } from '../../core/academy/teach/teach'
import { movesFromAlg } from '../../core/puzzles/cube3/logic'
import { createFistLockState, fistLockProgress, stepFistLock } from '../../core/gestures/fistLock'
import { DEFAULT_THRESHOLDS } from '../../core/gestures/GestureRecognizer'
import { moveFromKey } from '../../core/gestures/KeyboardAdapter'
import {
  activeSigns,
  createSignState,
  LAYER_SLICE,
  stepSigns,
  type ActiveSign,
} from '../../core/gestures/signGestures'
import { createGuide, expandSteps, followMove, invertStep } from '../../core/solvers/solveGuide'
import { createSmoother, signOptions } from '../../core/gestures/signReading'
import { createGestureFeed, useHandGestures } from '../../core/gestures/useHandGestures'
import type { GestureEvent } from '../../core/gestures/GestureRecognizer'
import type { LandmarkFrame } from '../../core/gestures/landmarks'
import type { Move, PuzzleId } from '../../core/puzzles/PuzzlePlugin'
import { usePuzzleStore } from '../../state/puzzleStore'
import { getSolverError, getSolverStatus, quarterTurns, retrySolver, subscribeSolverStatus } from '../../core/solvers/kociemba'
import { useAcademyStore } from '../../state/academyStore'
import { TURN_MS, useSettingsStore } from '../../state/settingsStore'
import { dominantMethod, flushUsage, recordUsage, type InputMethod } from '../../state/usageLog'
import { applyColorblindPaletteToColors } from '../../core/puzzles/colorblindPalette'

// Each place wears its face's colour: the 3x3 green, the Mirror Cube blue, a lesson orange.
// The Mirror Cube has no colours, so its unsolved face is uneven shades of its one colour.
const MIRROR_SHADES = ['#c9d6f2', '#8eaaf0', '#3d64b8', '#a9bdf0', '#4a73cf', '#d9e2f5', '#6f93e6', '#2f4f99']
const FACE_OF = {
  cube3: { colour: STICKER.green, bg: 'bg-sticker-green' },
  mirror: { colour: STICKER.blue, bg: 'bg-sticker-blue', mixed: MIRROR_SHADES },
  lesson: { colour: STICKER.orange, bg: 'bg-sticker-orange' },
}

// The slot of each face's centre on the cube, for the colour it shows.
const CENTRE_SLOTS: [string, string][] = [
  ['R', 'cube3-slot-1_0_0'],
  ['L', 'cube3-slot--1_0_0'],
  ['U', 'cube3-slot-0_1_0'],
  ['D', 'cube3-slot-0_-1_0'],
  ['F', 'cube3-slot-0_0_1'],
  ['B', 'cube3-slot-0_0_-1'],
]

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
  const { load, applyMove, reset, undo, isSolved, markStart, resetToStart } = usePuzzleStore()
  const startLength = usePuzzleStore((s) => s.startLength)
  const defaultInputMode = useSettingsStore((s) => s.defaultInputMode)
  const colorblindPalette = useSettingsStore((s) => s.colorblindPalette)
  const swapHands = useSettingsStore((s) => s.swapHands)
  const signReading = useSettingsStore((s) => s.signReading)
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
  const face = lesson ? FACE_OF.lesson : puzzleId === 'mirror' ? FACE_OF.mirror : FACE_OF.cube3

  // Each face's centre colour as the cube shows it (lessons turn it over, the colour-blind
  // palette swaps hues), for the turn keys and the scramble keys. Slice turns move centres,
  // so the pad reads them from the cube; the dialog always starts from a solved cube.
  const shown = useCallback(
    (hex: string) => {
      const c = lesson ? (FLIP_COLORS[hex] ?? hex) : hex
      return colorblindPalette ? applyColorblindPaletteToColors({ c }).c : c
    },
    [lesson, colorblindPalette],
  )
  const centreColours = useMemo(() => {
    if (!plugin || !state || plugin.id !== 'cube3') return null
    const all = plugin.faceletColors(state)
    return Object.fromEntries(CENTRE_SLOTS.map(([f, slot]) => [f, shown(all.get(slot)?.[f] ?? '#000000')]))
  }, [plugin, state, shown])
  const solvedColours = useMemo(
    () => (plugin?.id === 'cube3' ? Object.fromEntries(Object.entries(plugin.colorScheme).map(([f, hex]) => [f, shown(hex)])) : null),
    [plugin, shown],
  )

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
  // Precise reading smooths the landmarks first; the filter remembers the last
  // frames, so it lives across them and is rebuilt when the setting changes.
  const smoothing = useRef<ReturnType<typeof createSmoother> | null>(null)
  useEffect(() => {
    smoothing.current = signReading === 'precise' ? createSmoother() : null
  }, [signReading, inputMode])
  const onFrame = (f: LandmarkFrame, events: GestureEvent[]) => {
    const lock = stepFistLock(fistLockRef.current, f, thresholds.fist)
    fistLockRef.current = lock.next
    if (lock.toggled) setCameraLocked((v) => !v)
    const hold = Math.round(fistLockProgress(lock.next, f.timestampMs) * 20) / 20
    setLockHoldProgress((prev) => (prev === hold ? prev : hold))

    const opts = signOptions(signReading, swapHands)
    const r = stepSigns(signsRef.current, smoothing.current ? smoothing.current(f) : f, opts)
    signsRef.current = r.next
    for (const e of r.events) userMove(e.move, 'hands')
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
  const { scrambleLength, scrambleText, ranked, moveCount, assisted, timer, best, newBest, elapsed, startSession, countMove, uncountMove, markAssisted, checkFinish } =
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
  // The practice position was played as a demo. That shows the way but is not
  // a completion: the player still has to do it.
  const [watched, setWatched] = useState(false)
  const ownTurns = moveHistory.length - startLength

  // Put the cube in a lesson's practice position (not animated).
  const setupCase = (i: number, setup?: string) => {
    if (!lesson) return
    stopGuide()
    stopTeach()
    setLessonNote(null)
    setLessonDone(false)
    setWatched(false)
    flushQueue()
    reset()
    const start = setup ?? lesson.cases[i]?.setup
    if (start) for (const m of movesFromAlg(new Alg(start))) applyMove(m)
    // The practice position is where the lesson starts: Undo stops here.
    markStart()
    setCaseIndex(i)
    setRandomSetup(setup ?? null)
  }

  // A fresh, random position for this lesson (case number 0: none of the fixed ones).
  const newPosition = () => {
    if (lesson?.goal) setupCase(-1, practicePosition(lesson.id))
  }

  // --- Guide me through it: the teaching solver, one step at a time ---------------
  // The step on show, and the quarter turns of it still to make. The learner's
  // turns are matched against them; a turn that is not the one asked for, or
  // an Undo, makes the solver look again from wherever the cube is.
  const [randomSetup, setRandomSetup] = useState<string | null>(null)
  const [teach, setTeachState] = useState<{ step: TeachStep; total: number; pending: string[] } | null>(null)
  const teachRef = useRef(teach)
  const setTeach = (t: typeof teach) => {
    teachRef.current = t
    setTeachState(t)
  }
  const teachToken = useRef(0)
  const stopTeach = () => {
    teachToken.current++
    if (teachRef.current) setTeach(null)
  }
  // A half turn is two quarter turns that may go either way round ("F~"), so long as both go the same way.
  const quarters = (moves: string[]) => moves.flatMap((m) => (m.includes('2') ? [`${m[0]}~`, `${m[0]}~`] : [m]))
  const beginTeach = async (note?: string) => {
    const token = ++teachToken.current
    await drainQueue()
    if (token !== teachToken.current) return
    const { state: now } = usePuzzleStore.getState()
    if (!now) return
    if (lesson?.goal && stageDone(lesson.goal, now)) return setTeach(null)
    const step = teachSolve(now)[0]
    if (!step) return setTeach(null)
    const pending = quarters(step.moves)
    setTeach({ step, total: pending.length, pending })
    setLessonNote(note ?? null)
  }
  // Called with each turn the learner makes, before it lands.
  const followTeach = (move: Move) => {
    const t = teachRef.current
    if (!t) return
    let pending = t.pending
    let off = false
    for (const q of expandSteps([move])) {
      const p = pending[0]
      if (!p || !(p === q || (p.endsWith('~') && p[0] === q[0]))) off = true
      else if (p.endsWith('~') && pending[1]?.[0] === q[0] && pending[1].endsWith('~')) pending = [q, ...pending.slice(2)]
      else pending = pending.slice(1)
    }
    if (off) void beginTeach('That was not the turn shown, so the guide has looked again from here.')
    else if (!pending.length) void beginTeach()
    else setTeach({ ...t, pending })
  }

  const checkLesson = () => {
    if (!lesson) return
    const { state: now, moveHistory: history } = usePuzzleStore.getState()
    if (!now) return
    const met = lesson.goal ? stageDone(lesson.goal, now) : history.length - usePuzzleStore.getState().startLength >= 4
    if (met) {
      stopTeach()
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
        : { done: Math.min(moveHistory.length - startLength, 4), total: 4, unit: 'turns made' }
      : { done: 0, total: 1, unit: '' }

  // Play the whole practice solution as a demo, with the usual player controls.
  const watchIt = () => {
    const c = lesson?.cases[caseIndex]
    if (!lesson || !c) return
    closeSolution()
    setupCase(caseIndex)
    solveActiveRef.current = true
    setSolutionBoth({ moves: movesFromAlg(new Alg(c.solution)), index: 0 })
    setWatched(true)
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
  const userMove = (move: Move, method: InputMethod = 'drag') => {
    // A scramble is being dealt: a turn now would be buried in the middle of it.
    if (busyRef.current) return
    if (solveActiveRef.current) closeSolution()
    logTurn(move, method)
    countMove(move, true)
    followTeach(move)
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
          setLessonNote('That was not the move shown. Press Undo to take it back, then Step by step again.')
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
  // ---- The usage log (this device only; see src/state/usageLog.ts) -----------
  const lastTurnAtRef = useRef<number | null>(null)
  const attemptMethodsRef = useRef<InputMethod[]>([])
  const logTurn = (move: Move, method: InputMethod) => {
    const now = Date.now()
    const g = guideRef.current
    const asked = g ? g.steps[g.index] : null
    recordUsage({
      k: 'turn',
      at: now,
      m: method,
      gap: lastTurnAtRef.current === null ? null : now - lastTurnAtRef.current,
      g: asked === null ? 'none' : expandSteps([move])[0] === asked ? 'on' : 'off',
    })
    lastTurnAtRef.current = now
    attemptMethodsRef.current.push(method)
  }
  // A new attempt (the clock back at zero): gaps and the method tally start over.
  useEffect(() => {
    if (timer.start !== null) return
    lastTurnAtRef.current = null
    attemptMethodsRef.current = []
  }, [timer.start])
  // A scrambled cube solved: one line in the log.
  const loggedSolveRef = useRef<number | null>(null)
  useEffect(() => {
    if (timer.end === null || timer.start === null || loggedSolveRef.current === timer.end) return
    loggedSolveRef.current = timer.end
    recordUsage({ k: 'solve', at: timer.end, ms: timer.end - timer.start, moves: moveCount, m: dominantMethod(attemptMethodsRef.current), help: assisted, ranked })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.end])
  // Written when the page is hidden or the screen is left, not on every turn.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) flushUsage()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      flushUsage()
    }
  }, [])

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
      if (gen !== queueGenRef.current) return
      // The scrambled cube is where this attempt starts. Undo and Reset go back
      // to it and no further; only solving it gets you a solved cube.
      markStart()
      beginSearch()
    } catch (e) {
      setQueueError((e as Error).message)
    } finally {
      setBusyBoth(false)
    }
    // No guide here on purpose: after a scramble the user solves it
    // themselves by default, and opts in with "Guide me" if they want help.
  }

  // Back to where the attempt started: the scrambled cube if there is one (the
  // counters and clock start over with it), the solved cube if not. It never
  // solves a scramble; that is what "Solve for me" is for.
  const handleReset = () => {
    stopGuide()
    closeSolution()
    // Drop turns still waiting to animate, or they would land on the reset cube.
    flushQueue()
    resetToStart()
    forgetSearch()
    if (scrambleLength === null) {
      startSession(null)
      return
    }
    startSession(scrambleLength, scrambleText, ranked)
    beginSearch()
  }

  // A scramble of the player's choosing, typed or tapped in: set up at once (no
  // dealing animation -- they asked for a position, not a show) and practised
  // like any other, except that it cannot set a best time. An empty scramble is
  // a solved cube.
  const applyCustomScramble = (notation: string[]) => {
    if (!plugin) return
    stopGuide()
    closeSolution()
    flushQueue()
    reset()
    forgetSearch()
    setQueueError(null)
    const moves = notation.map((n) => ({ alg: new Alg(n), snapAngleDeg: plugin.snapAngleDeg }))
    for (const m of moves) applyMove(m)
    markStart()
    if (moves.length === 0) {
      startSession(null)
      return
    }
    startSession(quarterTurns(moves), notation.join(' '), false)
    beginSearch()
  }
  const [scrambleDialogOpen, setScrambleDialogOpen] = useState(false)

  const handleUndo = () => {
    closeSolution()
    setLessonNote(null)
    const last = usePuzzleStore.getState().moveHistory.at(-1)
    undo()
    if (last) {
      recordUsage({ k: 'undo', at: Date.now() })
      uncountMove(last)
      checkFinish()
    }
    if (lesson && teachRef.current) void beginTeach()
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
      // Typing in a field (the scramble box, say) is typing, not turning the cube.
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, dialog')) return
      if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        setCameraLocked((v) => !v)
        return
      }
      const move = moveFromKey({ key: e.key, shiftKey: e.shiftKey, altKey: e.altKey }, plugin.snapAngleDeg)
      if (!move) return
      e.preventDefault()
      userMove(move, 'keys')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, plugin])

  // The guide strip or the solution player is up.
  const panelOpen = guideStatus !== 'off' || solveStatus !== 'off'
  const showMouseTips = !lesson && inputMode === 'mouse' && tips.open && !panelOpen
  // Where that panel sits. On a narrow stage, across the bottom; wider, centred
  // above the cube, or in the top-left corner in Hands mode (the camera has the
  // top-right) and on a short screen (the cube needs the room above it).
  const panelPlace = `w-full @min-[40rem]:absolute @min-[40rem]:top-0 @min-[40rem]:w-max ${
    inputMode === 'hands'
      ? '@min-[40rem]:left-0 @min-[40rem]:max-w-[calc(100%-17rem)]'
      : '@min-[40rem]:left-1/2 @min-[40rem]:max-w-full @min-[40rem]:-translate-x-1/2'
  } [@media(max-height:30rem)]:@min-[40rem]:left-0 [@media(max-height:30rem)]:@min-[40rem]:max-w-[calc(50%-6rem)] [@media(max-height:30rem)]:@min-[40rem]:translate-x-0`

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-ink text-fg">
      <PlayHeader
        lesson={lesson}
        title={plugin?.displayName ?? puzzleId}
        place={face.bg}
        inputMode={inputMode}
        onInputMode={setInputMode}
        touchScreen={touchScreen}
        cameraLocked={cameraLocked}
        onToggleLock={toggleCameraLock}
      />

      {status === 'loading' && <p className="p-6 text-fg-faint">Loading the cube…</p>}
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
              note={lessonNote ?? (watched && (!solution || solution.index >= solution.moves.length) ? 'You watched it. Press Restart position and do it yourself to finish the lesson.' : null)}
              guiding={guideStatus !== 'off' || teach !== null}
              watching={solveStatus !== 'off'}
              progress={lessonProgress}
              randomPosition={caseIndex < 0}
              teach={teach ? { step: teach.step, done: teach.total - teach.pending.length, total: teach.total } : null}
              onTeach={() => void beginTeach()}
              onStopTeach={stopTeach}
              onNewPosition={newPosition}
              signMoves={lesson.algorithm?.moves ?? lesson.cases[caseIndex]?.solution ?? ''}
              onWatch={watchIt}
              onGuide={showMe}
              onSelectCase={setupCase}
            />
          )}
          {/* Above the cube on a narrow screen the lesson scrolls inside its own box: a fade along
              its lower edge says there is more below. */}
          {lesson && (
            <div aria-hidden className="pointer-events-none relative h-0 shrink-0 md:hidden">
              <div className="absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-panel to-transparent" />
            </div>
          )}
          <div className="@container relative min-h-0 w-full flex-1 overflow-hidden">
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
              guideMove={guide ? guide.steps[guide.index] : (teach?.pending[0]?.replace('~', '') ?? null)}
              focusSlots={teach ? [...teach.step.focus.pieces, ...(teach.step.focus.target ? [teach.step.focus.target] : [])] : null}
            />

            {/* A solve you made, or a lesson you finished: once, and briefly, under everything else on the stage. */}
            {((timer.end !== null && solved) || lessonDone) && (
              <SolvedBurst key={timer.end ?? 'lesson'} colour={face.colour} label={lessonDone ? 'Lesson complete' : 'Solved'} />
            )}

            {showMouseTips && <MouseTips onClose={tips.dismiss} mirror={plugin.id === 'mirror'} />}
            {!lesson && inputMode === 'mouse' && !tips.open && !panelOpen && <TipsButton onClick={tips.show} />}

            {inputMode === 'hands' && (
              <CameraPanel videoRef={gestures.videoRef} feed={gestures.feed} tracker={gestures.tracker} ready={gestures.ready} error={gestures.error} signs={heldSigns.map((h) => h.notation)} />
            )}

            {/* In Hands mode the top-left corner holds the instructions: the sign key, or the guide when it is up. */}
            {inputMode === 'hands' && !panelOpen && showHandsHelp && <HandsKey onClose={() => setShowHandsHelp(false)} />}
            {inputMode === 'hands' && !panelOpen && !showHandsHelp && (
              <button
                type="button"
                onClick={() => setShowHandsHelp(true)}
                className={`absolute left-3 top-3 inline-flex min-h-9 items-center rounded-lg px-3.5 text-sm font-medium transition duration-200 ease-click pointer-coarse:min-h-11 sm:left-4 sm:top-4 ${KEY_SURFACE}`}
              >
                Show hand signs
              </button>
            )}

            {/* What sits over the bottom of the stage, stacked so nothing covers anything else: the
                signs being held, the view lock, and (on a phone) the guide or the solution player.
                On a wider screen those two are lifted out of the stack to the top. */}
            <div className="pointer-events-none absolute inset-3 z-10 flex flex-col items-center justify-end gap-2 sm:inset-4">
              {signsActive && heldSigns.length > 0 && <SignsHud signs={heldSigns} />}

              {(cameraLocked || lockHoldProgress > 0) && <LockBadge locked={cameraLocked} hold={lockHoldProgress} />}

              {guideStatus !== 'off' && (
                <GuidePanel
                  className={panelPlace}
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
                  className={panelPlace}
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
          </div>

          {touchScreen && inputMode === 'mouse' && (
            <MovePad disabled={busy} colours={centreColours} hint={guideStatus === 'following' && guide ? guide.steps[guide.index] : null} onTurn={(notation) => userMove({ alg: new Alg(notation), snapAngleDeg: plugin.snapAngleDeg }, 'buttons')} />
          )}

          {lesson ? (
            <footer className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 bg-panel px-3 py-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] sm:px-6 sm:py-3">
              <div className="grid flex-1 grid-cols-[1fr_1.4fr_1.4fr] gap-1.5 sm:contents">
                <button type="button" className={BUTTON} onClick={handleUndo} disabled={busy || moveHistory.length <= startLength}>
                  Undo
                </button>
                <button type="button" className={BUTTON} onClick={() => setupCase(caseIndex, caseIndex < 0 ? (randomSetup ?? '') : undefined)} disabled={busy}>
                  Restart position
                </button>
                <Link to="/learn" className={`${BUTTON} sm:order-last`}>
                  All lessons
                </Link>
              </div>
              {/* How this attempt at the lesson stands: above the keys on a phone, between them on a wider screen. */}
              <div className="order-first flex w-full justify-center sm:order-none sm:mx-auto sm:w-auto">
                <div className={`flex min-h-10 items-center gap-3 rounded-lg px-3 py-1 text-xs sm:text-sm ${WELL}`}>
                  <span data-testid="lesson-status" className={`flex items-center gap-2 font-semibold ${lessonDone ? 'text-fg' : 'text-fg-muted'}`}>
                    <FaceGlyph mode={lessonDone ? 'solved' : 'scrambled'} colour={face.colour} />
                    {lessonDone ? 'Complete' : watched ? 'Watched' : 'In progress'}
                  </span>
                  {/* Your own turns only: not the ones that set the position up, nor a demo's. */}
                  {!watched && (
                    <>
                      <span aria-hidden className="h-4 w-px bg-white/10" />
                      <span className="tabular-nums text-fg-faint" data-testid="move-count">
                        <span className="font-semibold text-fg">{ownTurns}</span> {ownTurns === 1 ? 'move' : 'moves'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </footer>
          ) : (
          <PlayActions
            busy={busy}
            solved={solved}
            guideActive={guideStatus !== 'off'}
            solveActive={solveStatus !== 'off'}
            canUndo={moveHistory.length > startLength}
            solverDown={solverStatus === 'failed'}
            canReset={moveHistory.length > startLength}
            ranked={ranked}
            onCustom={() => setScrambleDialogOpen(true)}
            scrambleLength={scrambleLength}
            scrambleText={scrambleText}
            moveCount={moveCount}
            timer={timer}
            elapsed={elapsed}
            assisted={assisted}
            newBest={newBest}
            best={best}
            face={face}
            onScramble={() => void handleScramble()}
            onUndo={handleUndo}
            onReset={handleReset}
            onGuide={() => void startGuide()}
            onSolve={() => void handleSolve()}
          />
          )}

          {scrambleDialogOpen && (
            <ScrambleDialog
              initial={scrambleText}
              colours={solvedColours}
              onRandom={() => plugin.scramble().then((moves) => moves.map((m) => m.alg.toString()))}
              onUse={(notation) => {
                setScrambleDialogOpen(false)
                applyCustomScramble(notation)
              }}
              onClose={() => setScrambleDialogOpen(false)}
            />
          )}

          {(error || queueError) && <p className="bg-panel px-6 pb-3 text-sm text-[#FF8A9A]">{error || queueError}</p>}
          {solverStatus === 'failed' && (
            <p className="flex flex-wrap items-center gap-3 bg-panel px-6 pb-3 text-sm text-sticker-yellow" data-testid="solver-failed">
              The solver could not start, so Scramble, Guide me and Solve for me are off. You can still turn the cube and set up a scramble of your own.
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
