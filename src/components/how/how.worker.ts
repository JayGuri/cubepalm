/// <reference lib="webworker" />
import { createRefineJob, initProofTables, initTwoPhase, pathToText, randomCubie, randomScramble, solveDetailed } from '../../core/solvers/twoPhase'

// The How it works page's own background thread. It runs the app's solver and
// scrambler (src/core/solvers/twoPhase.ts) exactly as shipped, and reports what
// they do with timestamps taken here, so the page shows the code working rather
// than a recording of it.

export type HowRequest =
  | { type: 'search'; id: number; budgetMs: number }
  | { type: 'prove'; id: number; turns: number }
  | { type: 'sample'; id: number; total: number }
  | { type: 'cancel' }

export type HowResponse =
  | { id: number; type: 'tables'; ms: number }
  | { id: number; type: 'scramble'; scramble: string }
  | { id: number; type: 'route'; t: number; cost: number; route: string; view: number }
  | { id: number; type: 'done'; t: number; proven: boolean }
  | { id: number; type: 'proved'; scramble: string; solution: string; cost: number; noneBelow: number; ms: number }
  | { id: number; type: 'counts'; n: number; counts: number[][] }
  | { id: number; type: 'error'; message: string }

const post = (r: HowResponse) => self.postMessage(r)
const pause = () => new Promise((resolve) => setTimeout(resolve, 0))
let current = 0 // the request still wanted; anything older stops

let tablesMs: number | null = null
function tables(id: number) {
  if (tablesMs === null) {
    const t0 = performance.now()
    initTwoPhase()
    tablesMs = performance.now() - t0
  }
  post({ id, type: 'tables', ms: tablesMs })
}

// The six views searched side by side, each told the best cost the others have
// found: the app's helper workers do the same, a few views each.
async function search(id: number, budgetMs: number) {
  tables(id)
  const scramble = randomScramble()
  if (id !== current) return
  post({ id, type: 'scramble', scramble })
  const jobs = Array.from({ length: 6 }, (_, view) => createRefineJob(scramble, undefined, { index: view, count: 6 }))
  let best = Infinity
  const start = performance.now()
  jobs.forEach((job, view) => {
    job.onImprove = (path, cost) => {
      if (cost >= best) return
      best = cost
      post({ id, type: 'route', t: performance.now() - start, cost, route: pathToText(path), view })
      for (const other of jobs) other.tighten(cost)
    }
  })
  for (;;) {
    // One view finishing every cost below the best proves nothing cheaper exists.
    for (const job of jobs) if (job.run(5)) return post({ id, type: 'done', t: performance.now() - start, proven: true })
    if (performance.now() - start >= budgetMs) return post({ id, type: 'done', t: performance.now() - start, proven: false })
    await pause()
    if (id !== current) return
  }
}

const FACES = 'URFDLB'
const below = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n // a picture, not a fairness claim

// k random face turns from solved, never the same face twice running (as in docs/research/solver.md).
function nearSolved(turns: number): string {
  const out: string[] = []
  while (out.length < turns) {
    const face = FACES[below(6)]
    if (out.length && out[out.length - 1][0] === face) continue
    out.push(face + ['', "'", '2'][below(3)])
  }
  return out.join(' ')
}

function prove(id: number, turns: number) {
  tables(id)
  initProofTables()
  const scramble = nearSolved(turns)
  const t0 = performance.now()
  // The budgets docs/research/solver.md used for its near-solved positions.
  const result = solveDetailed(scramble, { timeMs: 300, proveMs: 2000 })
  post({ id, type: 'proved', scramble, ...result, ms: performance.now() - t0 })
}

// Four features of the drawn states (twoPhase.ts numbers corner slots URF UFL
// ULB UBR DFR DLF DBL DRB and edge slots UR UF UL UB DR DF DL DB FR FL BL BR):
// the corner in URF, the twist in DRB and the flip in BR (both computed from the
// others), and the edge in BR (swapped by the parity fix).
async function sample(id: number, total: number) {
  const counts = [new Array(8).fill(0), new Array(3).fill(0), new Array(12).fill(0), new Array(2).fill(0)]
  for (let n = 0; n < total; ) {
    const until = Math.min(total, n + 4000)
    for (; n < until; n++) {
      const c = randomCubie()
      counts[0][c.cp[0]]++
      counts[1][c.co[7]]++
      counts[2][c.ep[11]]++
      counts[3][c.eo[11]]++
    }
    post({ id, type: 'counts', n, counts })
    await pause()
    if (id !== current) return
  }
}

self.onmessage = (e: MessageEvent<HowRequest>) => {
  const r = e.data
  if (r.type === 'cancel') {
    current = 0
    return
  }
  current = r.id
  const run = async () => (r.type === 'search' ? search(r.id, r.budgetMs) : r.type === 'prove' ? prove(r.id, r.turns) : sample(r.id, r.total))
  run().catch((err: Error) => post({ id: r.id, type: 'error', message: err.message }))
}
