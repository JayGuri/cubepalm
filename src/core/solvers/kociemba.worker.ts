/// <reference lib="webworker" />
import { initSolverCore, newScrambleAlg, Refiner, solveScrambleDetailed, warmProofTables, type RefineStep, type SolveOptions, type SolveResult } from './kociembaCore'

// Thin shim over the pure core: all real logic (and all the tests) live there.
export type SolverRequest =
  | { id: number; type: 'init'; proofs?: boolean }
  | { id: number; type: 'solve'; scramble: string; options?: SolveOptions }
  | { id: number; type: 'scramble' }
  | { id: number; type: 'refine'; scramble: string; bound?: number; slice?: { index: number; count: number } }
  | { id: number; type: 'tighten'; cost: number }
  | { id: number; type: 'cancel' }

export interface SolverResponse {
  id: number
  ok: boolean
  result?: SolveResult
  scramble?: string
  /** One slice of a background search (a 'refine' request answers with many of these). */
  progress?: RefineStep
  error?: string
}

// The background search, if one is running. It advances in 30 ms slices with a
// pause between them, so a cancel (or any other request) is heard within ~30 ms.
// How long one background search may run. Most of what a search will ever find
// it finds in the first few seconds; running every core flat out for a minute
// after each scramble bought about half a move and a hot laptop.
const SEARCH_BUDGET_MS = 12_000

let job: { id: number; refiner: Refiner } | null = null
let pumping = false

async function pump(): Promise<void> {
  if (pumping) return
  pumping = true
  try {
    while (job) {
      const current = job
      let step: RefineStep
      try {
        step = current.refiner.step(30)
      } catch (err) {
        self.postMessage({ id: current.id, ok: false, error: (err as Error).message } satisfies SolverResponse)
        if (job === current) job = null
        break
      }
      if (step.solution !== null || step.done) self.postMessage({ id: current.id, ok: true, progress: step } satisfies SolverResponse)
      if (step.done) {
        if (job === current) job = null
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  } finally {
    pumping = false
  }
}

self.onmessage = async (e: MessageEvent<SolverRequest>) => {
  const request = e.data
  const { id } = request
  try {
    if (request.type === 'init') {
      await initSolverCore()
      self.postMessage({ id, ok: true } satisfies SolverResponse)
      // The optimal-search tables are only needed later; build them now, while
      // nobody is waiting on the worker.
      if (request.proofs !== false) setTimeout(warmProofTables, 0)
      return
    }
    if (request.type === 'cancel') {
      if (job?.id === request.id) job = null
      return
    }
    if (request.type === 'tighten') {
      if (job?.id === id) job.refiner.tighten(request.cost)
      return
    }
    if (request.type === 'refine') {
      job = { id, refiner: new Refiner(request.scramble, request.bound, SEARCH_BUDGET_MS, request.slice) }
      void pump()
      return
    }
    if (request.type === 'scramble') {
      self.postMessage({ id, ok: true, scramble: newScrambleAlg() } satisfies SolverResponse)
      return
    }
    const result = await solveScrambleDetailed(request.scramble, request.options)
    self.postMessage({ id, ok: true, result } satisfies SolverResponse)
  } catch (err) {
    self.postMessage({ id, ok: false, error: (err as Error).message } satisfies SolverResponse)
  }
}
