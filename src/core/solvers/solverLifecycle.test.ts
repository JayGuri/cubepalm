import { Alg } from 'cubing/alg'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The wrapper owns the worker's life. These tests swap in workers that
// misbehave and check that a caller always gets an answer anyway.

const mv = (s: string) => ({ alg: new Alg(s), snapAngleDeg: 90 })

type Behaviour = 'crash' | 'silent' | 'refuse'

function fakeWorker(behaviour: Behaviour) {
  return class {
    onmessage: ((e: MessageEvent) => void) | null = null
    onerror: (() => void) | null = null
    terminated = false
    postMessage(message: { id: number }): void {
      if (behaviour === 'crash') queueMicrotask(() => this.onerror?.())
      // 'refuse': the worker is alive but says it could not do what was asked.
      if (behaviour === 'refuse') queueMicrotask(() => this.onmessage?.({ data: { id: message.id, ok: false, error: 'out of memory' } } as MessageEvent))
      // 'silent': the message is swallowed and nothing ever comes back.
    }
    terminate(): void {
      this.terminated = true
    }
  }
}

async function freshSolver(behaviour: Behaviour) {
  vi.resetModules()
  vi.stubGlobal('Worker', fakeWorker(behaviour))
  return import('./kociemba')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('solver lifecycle', () => {
  it('a worker that crashes on start falls back to the main thread', async () => {
    const solver = await freshSolver('crash')
    const seen: string[] = []
    solver.subscribeSolverStatus(() => seen.push(solver.getSolverStatus()))
    await solver.initSolver()
    expect(seen).toEqual(['warming', 'fallback'])
    // ...and the solver still answers.
    const { moves } = await solver.solveFromHistory(['R', 'U'].map(mv))
    expect(moves.map((m) => m.alg.toString())).toEqual(["U'", "R'"])
  }, 30000)

  it('a worker that never answers is abandoned, not waited on for ever', async () => {
    vi.useFakeTimers()
    const solver = await freshSolver('silent')
    const started = solver.initSolver()
    expect(solver.getSolverStatus()).toBe('warming')
    await vi.advanceTimersByTimeAsync(13_000)
    vi.useRealTimers()
    await started
    expect(solver.getSolverStatus()).toBe('fallback')
  }, 30000)

  it('starting twice builds once, and a retry starts over', async () => {
    const solver = await freshSolver('crash')
    expect(solver.initSolver()).toBe(solver.initSolver())
    await solver.initSolver()
    await solver.retrySolver()
    expect(solver.getSolverStatus()).toBe('fallback')
  }, 30000)

  it('a worker that cannot build its tables hands over to the main thread, and the reason is kept', async () => {
    const solver = await freshSolver('refuse')
    await solver.initSolver()
    // Not "failed": the main thread has not been tried and found wanting.
    expect(solver.getSolverStatus()).toBe('fallback')
    expect(solver.getSolverError()).toContain('out of memory')
    const { moves } = await solver.solveFromHistory(['R'].map(mv))
    expect(moves.map((m) => m.alg.toString())).toEqual(["R'"])
  }, 30000)

  it('a worker lost while still warming up leaves its reason behind too', async () => {
    const solver = await freshSolver('crash')
    await solver.initSolver()
    expect(solver.getSolverError()).toBe('solver worker crashed')
  }, 30000)
})
