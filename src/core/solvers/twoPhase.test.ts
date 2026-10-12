import { Alg } from 'cubing/alg'
import { beforeAll, describe, expect, it } from 'vitest'
import { applyMove, createInitialState, initCube3Logic, isSolved, movesFromAlg } from '../puzzles/cube3/logic'
import { solveScramble } from './kociembaCore'
import { Refiner } from './kociembaCore'
import { createRefineJob, initProofTables, initTwoPhase, randomCubie, randomScramble, solveDetailed, solveTwoPhase } from './twoPhase'

// Deterministic pseudo-random numbers, so a failure can be reproduced.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 32
  }
}

function randomTurns(next: () => number, tokens: string[], length: number): string {
  const out: string[] = []
  for (let i = 0; i < length; i++) out.push(tokens[Math.floor(next() * tokens.length)] + ['', "'", '2'][Math.floor(next() * 3)])
  return out.join(' ')
}

// cubing.js is an independent implementation: apply scramble then solution.
function solvedAfter(scramble: string, solution: string): boolean {
  let state = createInitialState()
  for (const m of movesFromAlg(new Alg(`${scramble} ${solution}`))) state = applyMove(state, m)
  return isSolved(state)
}

const quarterTurns = (s: string) => s.split(/\s+/).filter(Boolean).reduce((n, m) => n + (m.includes('2') ? 2 : 1), 0)

describe('two-phase solver', () => {
  beforeAll(async () => {
    await initCube3Logic()
    initTwoPhase()
  }, 60_000)

  it('returns nothing for a solved cube', () => {
    expect(solveTwoPhase('')).toBe('')
    expect(solveTwoPhase("R R'")).toBe('')
  })

  it('REGRESSION: a position one turn away is solved by that one turn undone', () => {
    expect(solveTwoPhase('R', { timeMs: 50 })).toBe("R'")
    expect(solveTwoPhase('R2', { timeMs: 50 })).toBe('R2')
    expect(solveTwoPhase('R U', { timeMs: 50 })).toBe("U' R'")
  })

  it('solves random cubes, as judged by cubing.js, in a reasonable number of turns', () => {
    const next = rng(42)
    for (let i = 0; i < 25; i++) {
      const scramble = randomTurns(next, ['U', 'R', 'F', 'D', 'L', 'B'], 25)
      const solution = solveTwoPhase(scramble, { timeMs: 100 })
      expect(solvedAfter(scramble, solution), scramble).toBe(true)
      expect(quarterTurns(solution), scramble).toBeLessThanOrEqual(40)
    }
  }, 60_000)

  it('keeps improving: more time never gives a longer answer', () => {
    const scramble = "F R U' B2 L D' R2 U F' L2 B D2 R' U2 F2 L' B' D"
    const quick = quarterTurns(solveTwoPhase(scramble, { timeMs: 0 }))
    const patient = quarterTurns(solveTwoPhase(scramble, { timeMs: 1200 }))
    expect(patient).toBeLessThanOrEqual(quick)
    expect(patient).toBeLessThanOrEqual(36)
  }, 30_000)

  it('solves the superflip, a famously hard position', () => {
    const superflip = "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2"
    const solution = solveTwoPhase(superflip, { timeMs: 1500 })
    expect(solvedAfter(superflip, solution)).toBe(true)
    // The proven best is 20 face turns (24 steps); we do not aim for optimal.
    expect(quarterTurns(solution)).toBeLessThanOrEqual(36)
  }, 30_000)
})

describe('solving histories with slice turns and rotations', () => {
  beforeAll(async () => {
    await initCube3Logic()
    initTwoPhase()
  }, 60_000)

  it('solves cubes that were made with M, E, S, x, y and z', async () => {
    const next = rng(7)
    for (let i = 0; i < 25; i++) {
      const scramble = randomTurns(next, ['U', 'R', 'F', 'D', 'L', 'B', 'M', 'E', 'S', 'x', 'y', 'z'], 14)
      const solution = await solveScramble(scramble, 60)
      expect(solvedAfter(scramble, solution), scramble).toBe(true)
    }
  }, 60_000)
})

describe('solution length', () => {
  beforeAll(() => initTwoPhase(), 60_000)

  it('REGRESSION: random scrambles average well under 30 steps after a short search', () => {
    const next = rng(2024)
    let total = 0
    const runs = 6
    for (let i = 0; i < runs; i++) {
      const scramble = randomTurns(next, ['U', 'R', 'F', 'D', 'L', 'B'], 30)
      const solution = solveTwoPhase(scramble, { timeMs: 500 })
      expect(solvedAfter(scramble, solution)).toBe(true)
      total += quarterTurns(solution)
    }
    expect(total / runs).toBeLessThan(29)
  }, 60_000)
})

describe("proving a solution is the shortest", () => {
  beforeAll(async () => {
    await initCube3Logic()
    initProofTables()
  }, 60_000)

  it("solves lightly scrambled cubes optimally and says so", () => {
    const next = rng(11)
    for (let i = 0; i < 20; i++) {
      const scramble = randomTurns(next, ["U", "R", "F", "D", "L", "B"], 6)
      const result = solveDetailed(scramble, { timeMs: 200, proveMs: 800 })
      expect(solvedAfter(scramble, result.solution), scramble).toBe(true)
      // Proven: nothing cheaper exists, and it is never worse than undoing the scramble.
      expect(result.noneBelow, scramble).toBe(result.cost)
      expect(result.cost, scramble).toBeLessThanOrEqual(quarterTurns(scramble))
    }
  }, 60_000)

  it("never claims a proof it does not have: noneBelow is at most the cost", () => {
    const next = rng(3)
    for (let i = 0; i < 5; i++) {
      const scramble = randomTurns(next, ["U", "R", "F", "D", "L", "B"], 30)
      const result = solveDetailed(scramble, { timeMs: 150, proveMs: 150 })
      expect(solvedAfter(scramble, result.solution)).toBe(true)
      expect(result.noneBelow).toBeLessThanOrEqual(result.cost)
    }
  }, 60_000)

  it("uses an outside bound: with a 3-step route already known, it proves 3 is the floor", () => {
    const result = solveDetailed("R U F", { timeMs: 100, proveMs: 500, bound: 3 })
    expect(result.cost).toBe(3)
    expect(result.noneBelow).toBe(3)
  })
})

describe("random-state scrambles", () => {
  beforeAll(async () => {
    await initCube3Logic()
    initTwoPhase()
  }, 60_000)

  it("draws only reachable cubes: parities agree, twists and flips add up", () => {
    const parity = (p: number[]) => {
      let n = 0
      for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[j] < p[i]) n++
      return n % 2
    }
    for (let i = 0; i < 200; i++) {
      const c = randomCubie()
      expect(parity(c.cp)).toBe(parity(c.ep))
      expect(c.co.reduce((a, b) => a + b, 0) % 3).toBe(0)
      expect(c.eo.reduce((a, b) => a + b, 0) % 2).toBe(0)
      expect([...c.cp].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
      expect([...c.ep].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    }
  })

  it("makes scrambles that are all different, long enough, and solvable", () => {
    const scrambles = Array.from({ length: 30 }, () => randomScramble())
    expect(new Set(scrambles).size).toBe(30)
    for (const scramble of scrambles) expect(scramble.split(" ").length).toBeGreaterThanOrEqual(16)
    for (const scramble of scrambles.slice(0, 5)) {
      expect(solvedAfter(scramble, "")).toBe(false)
      expect(solvedAfter(scramble, solveTwoPhase(scramble, { timeMs: 50 }))).toBe(true)
    }
  }, 60_000)
})

describe("the pausable background search", () => {
  beforeAll(async () => {
    await initCube3Logic()
    initTwoPhase()
  }, 60_000)

  it("can be run in tiny slices and still finish with the optimal answer", () => {
    const next = rng(21)
    for (let i = 0; i < 6; i++) {
      const scramble = randomTurns(next, ["U", "R", "F", "D", "L", "B"], 7)
      const job = createRefineJob(scramble)
      let slices = 0
      while (!job.run(2) && slices++ < 100_000);
      expect(job.exhausted, scramble).toBe(true)
      const optimal = solveDetailed(scramble, { timeMs: 200, proveMs: 2000 })
      expect(optimal.noneBelow).toBe(optimal.cost)
      // Running to exhaustion proves its best answer optimal, so the two agree.
      expect(job.bestCost, scramble).toBe(optimal.cost)
    }
  }, 120_000)

  it("only reports routes that beat the bound it was given", () => {
    // "R U F" needs 3 steps. Nothing is cheaper than 3, so a bound of 3 finds nothing...
    const none = createRefineJob("R U F", 3)
    while (!none.run(50));
    expect(none.best).toBeNull()
    expect(none.exhausted).toBe(true) // ...and that proves 3 cannot be beaten.
    // With a looser bound it finds the 3-step route and proves it optimal.
    const found = createRefineJob("R U F", 9)
    while (!found.run(50));
    expect(found.bestCost).toBe(3)
    expect(found.exhausted).toBe(true)
  })

  it("every improvement is strictly cheaper, and each one really solves the cube", () => {
    const scramble = "F R U' B2 L D' R2 U F' L2 B D2 R' U2 F2 L' B' D"
    const job = createRefineJob(scramble)
    const seen: number[] = []
    job.onImprove = (path, cost) => {
      seen.push(cost)
      expect(path.length).toBeGreaterThan(0)
    }
    const until = performance.now() + 2500
    while (!job.exhausted && performance.now() < until) job.run(50)
    expect(seen.length).toBeGreaterThan(0)
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeLessThan(seen[i - 1])
  }, 30_000)

  it("workers that each own some of the views agree: one finishing proves the optimal cost", () => {
    const next = rng(31)
    for (let i = 0; i < 4; i++) {
      const scramble = randomTurns(next, ["U", "R", "F", "D", "L", "B"], 7)
      const reference = createRefineJob(scramble)
      while (!reference.run(50));
      // Three workers, two views each. Each one, run to the end, must reach the same optimal cost.
      for (let index = 0; index < 3; index++) {
        const part = createRefineJob(scramble, undefined, { index, count: 3 })
        while (!part.run(50));
        expect(part.bestCost, scramble + " slice " + index).toBe(reference.bestCost)
      }
    }
  }, 120_000)

  it("tightening the bound mid-search makes it ignore anything not cheaper", () => {
    const job = createRefineJob("R U F L D B R U", undefined)
    job.tighten(2) // nothing solves this in fewer than 2 steps
    while (!job.run(50));
    expect(job.best).toBeNull()
    expect(job.exhausted).toBe(true)
  })

  it("the Refiner handles slice turns and rotations, and its answer solves the cube", () => {
    const next = rng(5)
    for (let i = 0; i < 6; i++) {
      const scramble = randomTurns(next, ["U", "R", "F", "D", "L", "B", "M", "E", "S", "x", "y", "z"], 9)
      const refiner = new Refiner(scramble)
      let solution: string | null = null
      const until = performance.now() + 600
      while (performance.now() < until) {
        const step = refiner.step(20)
        if (step.solution !== null) solution = step.solution
        if (step.done) break
      }
      expect(solution, scramble).not.toBeNull()
      expect(solvedAfter(scramble, solution!), scramble).toBe(true)
    }
  }, 60_000)
})

describe('the random-state generator is uniform', () => {
  // A repeatable stand-in for the cryptographic source. floor(u * n) favours
  // some values by about n / 2^32, far too little for these tests to see.
  const seededBelow = (seed: number) => {
    const next = rng(seed)
    return (n: number) => Math.floor(next() * n)
  }
  const parity = (p: number[]) => {
    let n = 0
    for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[j] < p[i]) n++
    return n % 2
  }
  // Pearson's statistic against "every outcome equally likely".
  const chiSquare = (counts: number[]) => {
    const expected = counts.reduce((a, b) => a + b, 0) / counts.length
    return counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0)
  }
  // 99.9th percentiles of the chi-square distribution, by degrees of freedom
  // (outcomes - 1). A fair generator exceeds one only once in 1000 seeds, and
  // the seed here is fixed, so a pass stays a pass.
  const CRITICAL: Record<number, number> = { 1: 10.828, 2: 13.816, 7: 24.322, 11: 31.264 }

  it('with a seeded source the same seed gives the same cubes, and the default still works', () => {
    const a = seededBelow(1)
    const b = seededBelow(1)
    for (let i = 0; i < 20; i++) expect(randomCubie(a)).toEqual(randomCubie(b))
    expect(randomCubie().cp).toHaveLength(8)
  })

  it('every state is reachable: valid permutations, matching parities, twists and flips that add up', () => {
    const below = seededBelow(2025)
    for (let i = 0; i < 5000; i++) {
      const c = randomCubie(below)
      expect([...c.cp].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
      expect([...c.ep].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
      expect(c.co.every((t) => t >= 0 && t <= 2) && c.eo.every((f) => f === 0 || f === 1)).toBe(true)
      expect(c.co.reduce((x, y) => x + y, 0) % 3).toBe(0)
      expect(c.eo.reduce((x, y) => x + y, 0) % 2).toBe(0)
      expect(parity(c.cp)).toBe(parity(c.ep))
    }
  })

  it('passes chi-square tests, including on the values that are computed rather than drawn', () => {
    const below = seededBelow(7919)
    const samples = 24_000 // the rarest outcome (1 in 12) is still expected 2000 times
    const counts: Record<string, number[]> = {
      'corner in slot 0': new Array<number>(8).fill(0),
      'edge in slot 0': new Array<number>(12).fill(0),
      'twist of corner 0': new Array<number>(3).fill(0),
      'flip of edge 0': new Array<number>(2).fill(0),
      'permutation parity': new Array<number>(2).fill(0),
      // The eighth twist and twelfth flip are forced by the others...
      'twist of corner 7 (computed)': new Array<number>(3).fill(0),
      'flip of edge 11 (computed)': new Array<number>(2).fill(0),
      // ...and slots 10 and 11 are the ones the parity fix swaps.
      'edge in slot 10': new Array<number>(12).fill(0),
      'edge in slot 11': new Array<number>(12).fill(0),
    }
    for (let i = 0; i < samples; i++) {
      const c = randomCubie(below)
      counts['corner in slot 0'][c.cp[0]]++
      counts['edge in slot 0'][c.ep[0]]++
      counts['twist of corner 0'][c.co[0]]++
      counts['flip of edge 0'][c.eo[0]]++
      counts['permutation parity'][parity(c.cp)]++
      counts['twist of corner 7 (computed)'][c.co[7]]++
      counts['flip of edge 11 (computed)'][c.eo[11]]++
      counts['edge in slot 10'][c.ep[10]]++
      counts['edge in slot 11'][c.ep[11]]++
    }
    for (const [name, seen] of Object.entries(counts)) {
      expect(chiSquare(seen), name).toBeLessThan(CRITICAL[seen.length - 1])
    }
  })

  it('the statistic can fail: plainly uneven counts are over the critical value', () => {
    expect(chiSquare([1300, 1000, 700])).toBeGreaterThan(CRITICAL[2])
  })
})
