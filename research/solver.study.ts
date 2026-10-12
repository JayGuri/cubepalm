import os from 'node:os'
import { expect, it, vi } from 'vitest'
import { applyAlgString, createInitialState, initCube3Logic, isSolved } from '../src/core/puzzles/cube3/logic'
import { costOfPath, createRefineJob, initProofTables, initTwoPhase, pathToText, randomCubie, scrambleFor, solveDetailed } from '../src/core/solvers/twoPhase'
import { percent, round, seeded, table, writeReport, type Cell } from './report'

// How good are the solver's routes, how fast, and how often can it prove one
// is the shortest? Every figure the docs quote about the solver comes from here.

const SEED = 20261011
// Sample sizes are set by the clock: the study should finish in about ten
// minutes. Each random state is searched for the longest budget (5 s), so 50 of
// them take a little over four minutes; the proof experiment may spend up to
// about 2.3 s on each of 13 x 20 positions, though the easy ones return at once.
const STATES = 50
const BUDGETS_MS = [100, 500, 2000, 5000]
const NEAR_DEPTHS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
const NEAR_PER_DEPTH = 20
const NEAR_TWO_PHASE_MS = 300
const NEAR_PROOF_MS = 2000
const BUILD_RUNS = 5

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const mean = (xs: number[]) => sum(xs) / xs.length
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
const seconds = (ms: number) => `${ms / 1000} s`
const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1))

it('solver', async () => {
  await initCube3Logic()
  // cubing.js is an independent implementation of the cube: a route counts as
  // correct only if cubing.js agrees that scramble + route is a solved cube.
  let checked = 0
  let wrong = 0
  const check = (scramble: string, solution: string) => {
    checked++
    if (!isSolved(applyAlgString(createInitialState(), `${scramble} ${solution}`))) wrong++
  }

  // ---- 1. Building the tables ----------------------------------------------
  // The tables live in module variables, so each run loads a fresh copy of the
  // solver module. The first run also pays for the JavaScript engine compiling
  // the code, which is what a page load pays too.
  const twoPhaseMs: number[] = []
  const proofMs: number[] = []
  for (let run = 0; run < BUILD_RUNS; run++) {
    vi.resetModules()
    const fresh = await import('../src/core/solvers/twoPhase')
    const t0 = performance.now()
    fresh.initTwoPhase()
    const t1 = performance.now()
    fresh.initProofTables() // the two-phase tables exist already, so this times the proof tables alone
    const t2 = performance.now()
    twoPhaseMs.push(t1 - t0)
    proofMs.push(t2 - t1)
  }
  const buildRows = [
    ['two-phase tables (6 move tables, 5 pruning tables)', ...twoPhaseMs.map((ms) => round(ms, 0)), round(Math.min(...twoPhaseMs), 0), round(median(twoPhaseMs), 0)],
    ['proof tables (3 move tables, 3 pruning tables)', ...proofMs.map((ms) => round(ms, 0)), round(Math.min(...proofMs), 0), round(median(proofMs), 0)],
  ]

  // Sizes follow from the coordinates; one byte per entry.
  const [twist, flip, slice, perm8, perm4, edge3, edge4] = [3 ** 7, 2 ** 11, factorial(12) / (factorial(4) * factorial(8)), factorial(8), factorial(4), 12 ** 3, 12 ** 4]
  const sizeRows: Cell[][] = [
    ['phase 1: slice position x corner twist', slice * twist],
    ['phase 1: slice position x edge flip', slice * flip],
    ['phase 1: corner twist x edge flip', twist * flip],
    ['phase 2: slice permutation x corner permutation', perm4 * perm8],
    ['phase 2: slice permutation x edge permutation', perm4 * perm8],
    ['proof: corner permutation', perm8],
    ['proof: slots of UR UF UL x slots of UB DR DF', edge3 * edge3],
    ['proof: slots of FR FL BL BR', edge4],
  ]
  const sixEdgePlacements = factorial(12) / factorial(6)

  initTwoPhase()
  initProofTables()

  // ---- 2. Route cost on random states, at several time budgets --------------
  const random = seeded(SEED)
  const below = (n: number) => Math.floor(random() * n)
  // One search per state, read at each budget: "the best route found within t
  // of starting", which is what the app's background search delivers.
  const quarter: number[][] = BUDGETS_MS.map(() => [])
  const face: number[][] = BUDGETS_MS.map(() => [])
  const firstQuarter: number[] = []
  const firstFace: number[] = []
  const firstMs: number[] = []
  let provenRandom = 0
  for (let i = 0; i < STATES; i++) {
    // The seeded state decides everything; the scramble is just one way to
    // write that state down for the solver (a first two-phase answer, reversed).
    const scramble = scrambleFor(randomCubie(below), 0)
    const job = createRefineJob(scramble)
    const start = performance.now()
    let seenFirst = false
    job.onImprove = (path, cost) => {
      if (seenFirst) return
      seenFirst = true
      firstMs.push(performance.now() - start)
      firstQuarter.push(cost)
      firstFace.push(path.length)
    }
    BUDGETS_MS.forEach((budget, b) => {
      for (;;) {
        const left = budget - (performance.now() - start)
        if (job.exhausted || (job.best !== null && left <= 0)) break
        job.run(Math.max(1, Math.min(25, left)))
      }
      const best = job.best!
      check(scramble, pathToText(best))
      quarter[b].push(costOfPath(best))
      face[b].push(best.length)
    })
    if (job.exhausted) provenRandom++
  }
  const stats = (label: string, xs: number[]) => [label, round(mean(xs)), median(xs), Math.min(...xs), Math.max(...xs)]
  const statRows = (first: number[], byBudget: number[][]) => [
    stats('first answer', first),
    ...BUDGETS_MS.map((budget, b) => stats(`after ${seconds(budget)}`, byBudget[b])),
  ]
  const histogram = (byBudget: number[][]) => {
    const all = byBudget.flat()
    const rows: number[][] = []
    for (let v = Math.min(...all); v <= Math.max(...all); v++) rows.push([v, ...byBudget.map((xs) => xs.filter((x) => x === v).length)])
    return table(['cost', ...BUDGETS_MS.map(seconds)], rows)
  }

  // ---- 3. Proofs of optimality, by distance from solved ----------------------
  const nearRandom = seeded(SEED + 1)
  const suffixes = ['', '2', "'"]
  const nearRows: Cell[][] = []
  for (const depth of NEAR_DEPTHS) {
    let proven = 0
    const costs: number[] = []
    const times: number[] = []
    for (let i = 0; i < NEAR_PER_DEPTH; i++) {
      // `depth` random face turns, never the same face twice running.
      const turns: string[] = []
      let lastFace = -1
      while (turns.length < depth) {
        const f = Math.floor(nearRandom() * 6)
        if (f === lastFace) continue
        lastFace = f
        turns.push('URFDLB'[f] + suffixes[Math.floor(nearRandom() * 3)])
      }
      const scramble = turns.join(' ')
      const t0 = performance.now()
      const result = solveDetailed(scramble, { timeMs: NEAR_TWO_PHASE_MS, proveMs: NEAR_PROOF_MS })
      times.push(performance.now() - t0)
      check(scramble, result.solution)
      costs.push(result.cost)
      if (result.noneBelow === result.cost) proven++
    }
    nearRows.push([depth, NEAR_PER_DEPTH, proven, percent(proven / NEAR_PER_DEPTH, 0), round(mean(costs)), round(median(times), 0), round(Math.max(...times), 0)])
  }

  writeReport({
    name: 'solver',
    title: 'The solver, measured',
    summary:
      'CubePalm solves the cube with a two-phase (Kociemba-style) search that keeps improving its answer, plus a whole-cube search that can prove an answer is the shortest ' +
      '(`src/core/solvers/twoPhase.ts`). This report measures how long its tables take to build, how short its routes are on uniformly random cubes at several time budgets, ' +
      'how often it can prove a route optimal as the cube gets further from solved, and checks every route it produced against an independent cube implementation.',
    parameters: {
      seed: SEED,
      'random states': `${STATES} (uniform over all reachable cubes, from the seeded generator; chosen so the 5 s budget takes about four minutes in total)`,
      'time budgets': BUDGETS_MS.map(seconds).join(', '),
      'near-solved positions': `${NEAR_PER_DEPTH} for each of ${NEAR_DEPTHS.length} depths (${NEAR_DEPTHS[0]} to ${NEAR_DEPTHS[NEAR_DEPTHS.length - 1]} random face turns)`,
      'near-solved budgets': `two-phase ${seconds(NEAR_TWO_PHASE_MS)}, proof ${seconds(NEAR_PROOF_MS)}`,
      machine: `${os.cpus()[0].model.trim()}, ${os.cpus().length} logical cores, ${os.platform()} ${os.arch()}`,
      runtime: `Node ${process.version}, one thread`,
    },
    sections: [
      {
        heading: 'Building the tables',
        body:
          `Milliseconds, ${BUILD_RUNS} runs, each on a freshly loaded copy of the solver module. Run 1 includes the engine compiling the code. ` +
          'The runs can differ by a factor of two, and the later ones are not reliably faster than the first: each reload leaves the previous copy of the tables in memory for the garbage collector, ' +
          'and the cause of the spread has not been isolated. Read the figures as a range, not as one number.\n\n' +
          table(['tables', ...twoPhaseMs.map((_, i) => `run ${i + 1}`), 'fastest', 'median'], buildRows) +
          '\n\nPruning-table sizes (one byte per entry), which follow from the coordinates:\n\n' +
          table(['table', 'entries'], sizeRows) +
          `\n\nTotal: ${sum(sizeRows.map((r) => r[1] as number))} bytes of pruning tables. The six-edge table is indexed by two base-12 codes for simplicity, so only ` +
          `${sixEdgePlacements} of its ${edge3 * edge3} entries (12 x 11 x 10 x 9 x 8 x 7 placements of six different edges) are ever used.`,
      },
      {
        heading: 'Route cost in quarter turns',
        body:
          `The unit the app counts: a half turn is two steps. ${STATES} random states; one search each, read at each budget, six views in one thread. ` +
          '"First answer" is the first route the search finds, which does not depend on the machine.\n\n' +
          table(['budget', 'mean', 'median', 'min', 'max'], statRows(firstQuarter, quarter)) +
          `\n\nThe first answer arrived after a mean of ${round(mean(firstMs), 1)} ms (median ${round(median(firstMs), 1)} ms, slowest ${round(Math.max(...firstMs), 1)} ms).\n\n` +
          'Number of states whose best route had each cost:\n\n' +
          histogram(quarter),
      },
      {
        heading: 'The same routes in face turns',
        body:
          'For comparison with the literature, which usually counts a half turn as one move. These are the same routes as above, recounted: ' +
          'the search minimises quarter turns, so it is not trying to make these numbers small.\n\n' +
          table(['budget', 'mean', 'median', 'min', 'max'], statRows(firstFace, face)) +
          '\n\n' +
          histogram(face),
      },
      {
        heading: 'How often a route is proven shortest',
        body:
          `Positions made by k random face turns from solved (never the same face twice running), ${NEAR_PER_DEPTH} per k, solved with \`solveDetailed\`. ` +
          'A route is "proven" when the solver reports that no route costs less (`noneBelow === cost`). Cost is in quarter turns; time is for the whole call.\n\n' +
          table(['k', 'positions', 'proven', 'proven %', 'mean cost', 'median time (ms)', 'slowest (ms)'], nearRows) +
          `\n\nOn the ${STATES} uniformly random states above, the two-phase search exhausted every cheaper cost level (and so proved its route optimal) within ${seconds(BUDGETS_MS[BUDGETS_MS.length - 1])} for ${provenRandom} of them.`,
      },
      {
        heading: 'Correctness',
        body:
          `Every route produced above (${checked} of them: each random state at each budget, and each near-solved position) was applied after its scramble in cubing.js, ` +
          `an independent implementation of the cube. ${checked - wrong} left the cube solved; ${wrong} did not.`,
      },
      {
        heading: 'What this does and does not show',
        body: [
          `- One machine, Node rather than a browser, one thread. The app runs the same code in web workers and splits the six views across up to four of them, so its timings differ. Costs "after t" depend on machine speed; "first answer" costs do not.`,
          `- ${STATES} random states is a small sample: the means carry sampling error, and the minimum and maximum say little about the rarest cubes.`,
          '- The random states are uniform over all reachable cubes (see `docs/research/scrambles.md`), so the route costs describe typical scrambles, not hard positions chosen on purpose.',
          '- "k random face turns" is not "distance k": turns can cancel, so some positions are closer to solved than k. The mean cost column shows the real distance wherever the route was proven.',
          '- "Proven" rests on the arguments in `docs/MATH.md` (the lower bounds never over-estimate, the search is complete). The cubing.js check confirms that each route solves its cube; it cannot confirm that a route is the shortest.',
          '- Timings were taken once per position, with nothing else deliberately running, but an ordinary desktop is not a quiet benchmark machine.',
        ].join('\n'),
      },
    ],
  })

  expect(wrong).toBe(0)
})
