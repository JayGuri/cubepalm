import { Alg } from 'cubing/alg'
import type { Move } from '../puzzles/PuzzlePlugin'
import { initSolverCore, newScrambleAlg, Refiner, solveScrambleDetailed, type RefineStep, type SolveOptions } from './kociembaCore'
import type { SolverRequest, SolverResponse } from './kociemba.worker'

// Main-thread wrapper, and the one place that owns the solver's lifecycle: it
// starts the worker, notices when it dies or stalls, falls back to the main
// thread, and says which of those is true. The tables are built off the main
// thread and warmed at app start, never on the first Solve press.

/**
 *   idle      -- nothing started yet.
 *   warming   -- the tables are being built.
 *   ready     -- a worker is answering.
 *   fallback  -- the worker never came up or died; the main thread is answering
 *                (slower, and the page pauses while it thinks, but correct).
 *   failed    -- even the main thread could not build the tables.
 */
export type SolverStatus = 'idle' | 'warming' | 'ready' | 'fallback' | 'failed'

let status: SolverStatus = 'idle'
let statusError: string | null = null
const statusListeners = new Set<() => void>()
function setStatus(next: SolverStatus, error: string | null = null): void {
  status = next
  statusError = error
  for (const listener of statusListeners) listener()
}
export const getSolverStatus = (): SolverStatus => status
export const getSolverError = (): string | null => statusError
export function subscribeSolverStatus(listener: () => void): () => void {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}

let worker: Worker | null = null
// Set when the worker never came up; everything then runs on the main thread.
let workerDisabled = false
let nextId = 1
const pending = new Map<number, { resolve: (r: SolverResponse) => void; reject: (e: Error) => void }>()
// Listeners for background searches: they get many answers, not one.
const progressHandlers = new Map<number, (step: RefineStep) => void>()

function supportsWorker(): boolean {
  return typeof Worker !== 'undefined' && typeof import.meta.url === 'string'
}

/** The worker is gone for good: fail whatever was waiting on it and answer from the main thread from now on. */
function abandonWorker(reason: string): void {
  workerDisabled = true
  worker?.terminate()
  worker = null
  progressHandlers.clear()
  for (const [, entry] of pending) entry.reject(new Error(reason))
  pending.clear()
  releaseSolverPool(true)
  if (status === 'ready') setStatus('fallback', reason)
}

function getWorker(): Worker | null {
  if (workerDisabled || !supportsWorker()) return null
  if (worker) return worker
  try {
    worker = new Worker(new URL('./kociemba.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<SolverResponse>) => {
      if (e.data.progress) {
        progressHandlers.get(e.data.id)?.(e.data.progress)
        if (e.data.progress.done) progressHandlers.delete(e.data.id)
        return
      }
      const entry = pending.get(e.data.id)
      if (!entry) return
      pending.delete(e.data.id)
      if (e.data.ok) entry.resolve(e.data)
      else entry.reject(new Error(e.data.error ?? 'solver failed'))
    }
    worker.onerror = () => abandonWorker('solver worker crashed')
  } catch {
    worker = null
  }
  return worker
}

type Request = Extract<SolverRequest, { type: 'init' | 'solve' | 'scramble' }> extends infer R ? (R extends { id: number } ? Omit<R, 'id'> : never) : never

/** The same pure core, on the main thread. Slower, but it cannot go missing. */
async function answerInline(request: Request): Promise<SolverResponse> {
  if (request.type === 'init') {
    await initSolverCore()
    return { id: 0, ok: true }
  }
  if (request.type === 'scramble') return { id: 0, ok: true, scramble: newScrambleAlg() }
  return { id: 0, ok: true, result: await solveScrambleDetailed(request.scramble, request.options) }
}

// How long a worker may take beyond the time it was told to think. A worker
// that is merely slow answers well inside this; one that is gone never does.
const ANSWER_GRACE_MS = 12_000

/**
 * One question, one answer, always. The worker is asked first; if it errors,
 * dies or goes silent, it is abandoned and the main thread answers instead, so
 * a caller is never left waiting on a promise that cannot settle.
 */
async function ask(request: Request): Promise<SolverResponse> {
  const w = getWorker()
  if (!w) return answerInline(request)
  const id = nextId++
  const thinking = request.type === 'solve' ? (request.options?.timeMs ?? 1500) + (request.options?.proveMs ?? 600) : 0
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await new Promise<SolverResponse>((resolve, reject) => {
      pending.set(id, { resolve, reject })
      timer = setTimeout(() => {
        if (pending.has(id)) abandonWorker('solver worker stopped answering')
      }, thinking + ANSWER_GRACE_MS)
      w.postMessage({ ...request, id } as SolverRequest)
    })
  } catch (e) {
    // The solver itself rejecting the question is a real error; a lost worker is not.
    if (!workerDisabled) throw e
    return answerInline(request)
  } finally {
    clearTimeout(timer)
  }
}

let starting: Promise<void> | null = null

/**
 * Builds the solver's tables, once. Normally a worker does it; if the worker
 * errors or has not answered within the grace period it is abandoned and the
 * main thread builds them instead, so solving and scrambling never hang.
 * Calling it again while it runs, or after it succeeded, is free.
 */
export function initSolver(): Promise<void> {
  if (starting) return starting
  setStatus('warming')
  starting = (async () => {
    try {
      await ask({ type: 'init' })
      setStatus(worker && !workerDisabled ? 'ready' : 'fallback', worker ? null : statusError)
    } catch (e) {
      setStatus('failed', (e as Error).message)
      starting = null
      throw e
    }
  })()
  return starting
}

/** Try again from scratch, with a fresh worker (after `failed`, or to leave `fallback`). */
export function retrySolver(): Promise<void> {
  workerDisabled = false
  poolDisabled = false
  starting = null
  return initSolver()
}

/** A solution, and whether it is provably the shortest one there is. */
export interface Solution {
  moves: Move[]
  optimal: boolean
}

/**
 * How hard to look.
 *   quick     -- a good answer at once (the guide's first route).
 *   normal    -- Solve for me.
 *   thorough  -- background refinement while you follow the guide.
 */
export type SolveEffort = 'quick' | 'normal' | 'thorough'

const EFFORT: Record<SolveEffort, SolveOptions> = {
  quick: { timeMs: 400, proveMs: 300 },
  normal: { timeMs: 3000, proveMs: 1000 },
  thorough: { timeMs: 6000, proveMs: 3000 },
}

const toMoves = (alg: Alg, snapAngleDeg: number): Move[] =>
  [...alg.childAlgNodes()].map((node) => ({ alg: new Alg([node]), snapAngleDeg }))

// The solver needs the sequence that produced the current state, not the state
// itself -- see the notes at the top of kociembaCore.ts.
export async function solveFromHistory(
  history: Move[],
  snapAngleDeg = 90,
  {
    // The Mirror Cube is only solved when it is also held the way it started
    // (its blocks differ in size), so a slice turn or rotation in the history
    // can't be absorbed by turning the whole cube.
    keepOrientation = false,
    effort = 'normal',
  }: { keepOrientation?: boolean; effort?: SolveEffort } = {},
): Promise<Solution> {
  const scramble = history.map((m) => m.alg.toString()).join(' ').trim()
  if (scramble.length === 0) return { moves: [], optimal: true }

  // Two valid ways back to solved; use whichever takes fewer turns.
  //  1. The solver's answer: two-phase search from six points of view, plus an
  //     optimal search that proves (or beats) it when the cube is close enough.
  //  2. Undoing the history in reverse, with cancelling moves merged
  //     (R R' vanishes, R R becomes R2). Always correct.
  const undo = toMoves(new Alg(scramble).invert().experimentalSimplify({ cancel: true }), snapAngleDeg)
  if (keepOrientation && /[MESxyz]/.test(scramble)) return { moves: undo, optimal: false }

  // The undo route's cost tells the optimal search where it can stop looking.
  const { result } = await ask({ type: 'solve', scramble, options: { ...EFFORT[effort], bound: quarterTurns(undo) } })
  const solver = result!.solution.trim() ? toMoves(new Alg(result!.solution), snapAngleDeg) : []
  const moves = quarterTurns(undo) <= quarterTurns(solver) ? undo : solver
  return { moves, optimal: quarterTurns(moves) <= result!.noneBelow }
}

// ---- The helper pool ---------------------------------------------------------
// Background refinement is spread over a few extra workers, each owning some of
// the six views, so it uses several CPU cores at once. They are created the
// first time a search is asked for, and let go when the play screen closes. The
// pool never takes more than half the cores, and at most four.
const POOL_SEARCH = new Map<number, (index: number, step: RefineStep) => void>()
let pool: Worker[] = []
let poolDisabled = false

function poolSize(): number {
  if (typeof navigator === 'undefined') return 1
  const cores = navigator.hardwareConcurrency ?? 2
  // A phone is also drawing the cube and maybe tracking hands on a battery:
  // two helpers at most there, four on a desktop, never more than half the cores.
  const phone = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  return Math.min(phone ? 2 : 4, Math.floor(cores / 2))
}

function ensurePool(): Worker[] {
  if (pool.length > 0 || poolDisabled || workerDisabled || !supportsWorker()) return pool
  const size = poolSize()
  try {
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL('./kociemba.worker.ts', import.meta.url), { type: 'module' })
      const index = i
      w.onmessage = (e: MessageEvent<SolverResponse>) => {
        if (e.data.progress) POOL_SEARCH.get(e.data.id)?.(index, e.data.progress)
      }
      w.onerror = () => releaseSolverPool(true)
      // Helpers only run the two-phase search, so they skip the proof tables.
      w.postMessage({ id: nextId++, type: 'init', proofs: false } satisfies SolverRequest)
      pool.push(w)
    }
  } catch {
    releaseSolverPool(true)
  }
  return pool
}

/** Let go of the helper workers (the play screen closing, or something going wrong). */
export function releaseSolverPool(failed = false): void {
  for (const w of pool) w.terminate()
  pool = []
  POOL_SEARCH.clear()
  if (failed) poolDisabled = true
}

/** One answer from a background search. */
export interface RefineUpdate {
  /** A cheaper route than the one in hand, or null while the search is still looking. */
  moves: Move[] | null
  /** The search has stopped. */
  done: boolean
  /** It stopped because nothing cheaper exists: the route in hand (or this one) is the shortest possible. */
  optimal: boolean
}

export interface RefineHandle {
  cancel(): void
}

/**
 * Keeps looking, in the background, for a route cheaper than `bound` quarter
 * turns from the cube that `history` makes. `onUpdate` hears about each
 * improvement and about the end of the search. Cancel it as soon as the cube
 * moves; it stops within a few milliseconds.
 */
export function refineFromHistory(
  history: Move[],
  bound: number,
  onUpdate: (update: RefineUpdate) => void,
  { snapAngleDeg = 90, keepOrientation = false }: { snapAngleDeg?: number; keepOrientation?: boolean } = {},
): RefineHandle {
  const scramble = history.map((m) => m.alg.toString()).join(' ').trim()
  const idle: RefineHandle = { cancel() {} }
  if (scramble.length === 0 || (keepOrientation && /[MESxyz]/.test(scramble))) return idle

  const report = (step: RefineStep) =>
    onUpdate({ moves: step.solution ? toMoves(new Alg(step.solution), snapAngleDeg) : null, done: step.done, optimal: step.done && step.optimal })

  // Several workers, each searching some of the views, sharing the best cost found.
  const helpers = ensurePool()
  if (helpers.length > 0) {
    const id = nextId++
    let best = bound
    let finished = 0
    let over = false
    const stopAll = () => {
      POOL_SEARCH.delete(id)
      for (const h of helpers) h.postMessage({ id, type: 'cancel' } satisfies SolverRequest)
    }
    POOL_SEARCH.set(id, (index, step) => {
      if (over) return
      if (step.solution !== null && step.cost < best) {
        best = step.cost
        report(step)
        for (let k = 0; k < helpers.length; k++) if (k !== index) helpers[k].postMessage({ id, type: 'tighten', cost: step.cost } satisfies SolverRequest)
      }
      if (!step.done) return
      // One view finished all its levels: nothing cheaper than the best exists.
      if (step.optimal) {
        over = true
        onUpdate({ moves: null, done: true, optimal: true })
        stopAll()
      } else if (++finished === helpers.length) {
        over = true
        onUpdate({ moves: null, done: true, optimal: false })
        stopAll()
      }
    })
    helpers.forEach((h, index) =>
      h.postMessage({ id, type: 'refine', scramble, bound, slice: { index, count: helpers.length } } satisfies SolverRequest),
    )
    return {
      cancel() {
        if (over) return
        over = true
        stopAll()
      },
    }
  }

  const w = getWorker()
  if (w) {
    const id = nextId++
    progressHandlers.set(id, report)
    w.postMessage({ id, type: 'refine', scramble, bound } satisfies SolverRequest)
    return {
      cancel() {
        if (!progressHandlers.delete(id)) return
        w.postMessage({ id, type: 'cancel' } satisfies SolverRequest)
      },
    }
  }

  // No worker: take short turns on the main thread instead.
  let refiner: Refiner
  try {
    refiner = new Refiner(scramble, bound)
  } catch {
    return idle
  }
  let stopped = false
  const tick = () => {
    if (stopped) return
    const step = refiner.step(15)
    if (step.solution !== null || step.done) report(step)
    if (!step.done) setTimeout(tick, 0)
  }
  setTimeout(tick, 0)
  return {
    cancel() {
      stopped = true
    },
  }
}

/** Turns as a person makes them: a half turn (R2, R2') counts as two. */
export function quarterTurns(moves: Move[]): number {
  return moves.reduce((n, m) => n + (/2/.test(m.alg.toString()) ? 2 : 1), 0)
}

// ---- Scrambles -------------------------------------------------------------
const RECENT_KEY = 'cubepalm.recentScrambles.v1'
const RECENT_LIMIT = 200

function recentScrambles(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : []
  } catch {
    return []
  }
}

function remember(scramble: string, recent: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([scramble, ...recent].slice(0, RECENT_LIMIT)))
  } catch {
    // Storage blocked: the scramble is still random, just not checked against old ones.
  }
}

/**
 * A fresh random-state scramble: a uniformly random cube (one of 43
 * quintillion), drawn with the browser's cryptographic random generator.
 * It is also checked against the last 200 scrambles on this device, so a
 * repeat cannot slip through even by chance.
 */
export async function newScramble(snapAngleDeg = 90): Promise<Move[]> {
  const recent = recentScrambles()
  for (let attempt = 0; ; attempt++) {
    const { scramble } = await ask({ type: 'scramble' })
    if (!recent.includes(scramble!) || attempt >= 5) {
      remember(scramble!, recent)
      return toMoves(new Alg(scramble!), snapAngleDeg)
    }
  }
}
