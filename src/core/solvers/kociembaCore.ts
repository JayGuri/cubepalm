// Pure, worker-agnostic solver entry point (kociemba.worker.ts is a thin shim
// over it, so everything here can be unit tested directly).
//
// The search itself lives in twoPhase.ts. This layer accepts what the app has
// to offer -- the history of moves that produced the current cube, which may
// include slice turns (M E S) and rotations -- and hands the solver plain face
// turns (see frame.ts), then relabels its answer for the cube as it is held.

import { fromOriginalFrame, toFaceTurns } from './frame'
import {
  costOfPath,
  createRefineJob,
  initProofTables,
  pathToText,
  type RefineJob,
  initTwoPhase,
  isTwoPhaseReady,
  randomScramble,
  solveDetailed,
  type SolveOptions,
  type SolveResult,
} from './twoPhase'

export type { SolveOptions, SolveResult }

// Building the two-phase tables costs about a second and a half, so the app
// warms them up at startup in a worker rather than on the first Solve press.
export async function initSolverCore(): Promise<void> {
  initTwoPhase()
}

/** The optimal-search tables (under a second); built after start-up, in the background. */
export function warmProofTables(): void {
  initProofTables()
}

export function isSolverReady(): boolean {
  return isTwoPhaseReady()
}

const ALG_PATTERN = /^([FRUBLDxyzMSE][2']?\s*)+$/
// Exactly 54 face letters with no separators, primes or doubles: a facelet
// string, never an algorithm. It is made of the letters U R F D L B, so it
// would pass the pattern above and silently produce a meaningless answer.
const FACELET_PATTERN = /^[URFDLB]{54}$/

function validate(alg: string): void {
  if (!ALG_PATTERN.test(alg)) {
    throw new Error(`not a valid algorithm for the solver: ${alg.slice(0, 60)}`)
  }
  if (FACELET_PATTERN.test(alg)) {
    throw new Error('received a 54-character facelet string; this solver takes a scramble algorithm, not facelets')
  }
}

/**
 * The best solution the solver can find for the cube reached by applying
 * `scrambleAlg` to a solved cube, with its cost and how much of the space below
 * it has been ruled out (`noneBelow === cost` means it is provably optimal).
 */
export async function solveScrambleDetailed(scrambleAlg: string, options: SolveOptions = {}): Promise<SolveResult> {
  const alg = scrambleAlg.trim()
  if (alg.length === 0) return { solution: '', cost: 0, noneBelow: 0 }
  validate(alg)
  const { turns, frame } = toFaceTurns(alg)
  const result = solveDetailed(turns, options)
  return { ...result, solution: fromOriginalFrame(result.solution, frame) }
}

/** Just the solution, as a space-separated algorithm. Empty when already solved. */
export async function solveScramble(scrambleAlg: string, timeMs?: number): Promise<string> {
  return (await solveScrambleDetailed(scrambleAlg, { timeMs })).solution
}

/** A random-state scramble (see randomScramble in twoPhase.ts). */
export function newScrambleAlg(): string {
  return randomScramble()
}

// ---- Background refinement ---------------------------------------------------
/** What one slice of a background search found. */
export interface RefineStep {
  /** A cheaper solution found during this slice, as an algorithm; null if none. */
  solution: string | null
  /** Cost of the best solution so far, in quarter turns (Infinity if none beats the bound). */
  cost: number
  /** The search has stopped. */
  done: boolean
  /** It stopped because every cheaper cost was ruled out: the best known route is the shortest there is. */
  optimal: boolean
}

/**
 * A two-phase search that keeps improving a solution in short slices, for the
 * guide to run in the background. `bound` is the cost of the route already in
 * hand: only strictly cheaper ones are reported. Give up after `maxMs`.
 */
export class Refiner {
  private readonly job: RefineJob
  private latest: string | null = null
  private readonly startedAt = performance.now()
  private readonly maxMs: number

  constructor(scrambleAlg: string, bound?: number, maxMs = 12_000, slice?: { index: number; count: number }) {
    this.maxMs = maxMs
    const alg = scrambleAlg.trim()
    validate(alg)
    const { turns, frame } = toFaceTurns(alg)
    this.job = createRefineJob(turns, bound, slice)
    this.job.onImprove = (path) => {
      this.latest = fromOriginalFrame(pathToText(path), frame)
    }
  }

  /** Another worker found a route costing `cost`: only cheaper ones matter now. */
  tighten(cost: number): void {
    this.job.tighten(cost)
  }

  step(ms: number): RefineStep {
    const finished = this.job.run(ms)
    const solution = this.latest
    this.latest = null
    const timedOut = !finished && performance.now() - this.startedAt > this.maxMs
    return {
      solution,
      cost: this.job.best ? costOfPath(this.job.best) : Infinity,
      done: finished || timedOut,
      optimal: finished,
    }
  }
}
