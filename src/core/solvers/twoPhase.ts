// Kociemba's two-phase algorithm, written from scratch for CubePalm, plus an
// optimal-solution prover and a random-state scrambler.
//
// THE IDEA. A cube has 43 quintillion states, far too many to search. Kociemba
// splits the problem in two:
//
//   Phase 1  get into the subgroup G1 = <U, D, R2, L2, F2, B2>. A cube is in G1
//            when every corner and edge is oriented correctly and the four
//            "slice" edges (FR FL BL BR) sit in the middle layer. That needs
//            only three small coordinates:  corner twist (3^7 = 2187),
//            edge flip (2^11 = 2048)  and  slice position (C(12,4) = 495).
//   Phase 2  inside G1, finish using only G1's ten moves. The state is again
//            three small coordinates: corner permutation (8! = 40320), the eight
//            non-slice edges' permutation (8! = 40320) and slice permutation (4! = 24).
//
// Each phase is an IDA* search (iterative deepening) guided by pruning tables:
// lower bounds on the cost still needed that never over-estimate, so cutting a
// branch whose bound exceeds what is left to spend never loses a solution.
// Phase 1 uses the EXACT phase-1 cost once phase1Table.ts has built it (built
// in the background; until then, three smaller tables).
//
// Cost is counted in QUARTER TURNS (R2 costs two), because that is what the
// on-screen guide counts: one sign, key press or drag is one quarter turn.
//
// GETTING SHORT ANSWERS. The search keeps going after its first answer and only
// accepts strictly cheaper ones. It looks at the cube from six points of view
// (three rotations, each also as the inverse problem) and explores them side by
// side, one cost level at a time, so cheap levels of every view are tried
// before expensive levels of any.
//
// PROVING AN ANSWER IS THE SHORTEST. Two-phase answers are short but not always
// the shortest. A second search -- plain IDA* over the whole cube, guided by
// several more lower bounds -- either finds a cheaper solution (which is then the
// shortest possible, because IDA* tries costs in increasing order) or rules out
// every cost below the answer, which proves it optimal.
//
// PARITY. Every quarter turn is an odd permutation of the corners and a half
// turn an even one, so every solution of a given cube costs an odd number of
// quarter turns or every one an even number, fixed by the cube's corner
// arrangement. Both searches use it: a route cheaper than C costs at most C - 2,
// so the level just below C (the most expensive one) never needs searching.

import {
  ALL_MOVES,
  ALLOWED,
  applyMoves,
  AXIS_SYM,
  CONJ_MOVE,
  conjugate,
  EDGES_A,
  EDGES_B,
  edgeSlotsOf,
  FACE_LETTERS,
  flipOf,
  isPhase2Move,
  isSolvedCubie,
  MOVES,
  multiply,
  N_EDGE3,
  N_EDGE4,
  N_FLIP,
  N_MOVES,
  N_PERM4,
  N_PERM8,
  N_SLICE,
  N_SYM,
  N_SYM_UD,
  N_TWIST,
  parityOf,
  permRank,
  permUnrank,
  PHASE2_MOVES,
  quarterCost,
  SLICE_EDGES,
  SLICE_GOAL,
  slicePositionOf,
  SLOT_AFTER,
  SOLVED,
  twistOf,
  type Cubie,
} from './cubie'
import { buildPhase1TableStep, getPhase1Table, initPhase1Table, isPhase1TableReady, N_PHASE1, phase1Cost, phase1Moves, phase1TableBuildMs, type Phase1Table } from './phase1Table'

export type { Cubie }
export { buildPhase1TableStep, initPhase1Table, isPhase1TableReady }

// ---- Tables --------------------------------------------------------------
interface Tables {
  twistMove: Uint16Array
  flipMove: Uint16Array
  sliceMove: Uint16Array
  cpermMove: Uint16Array // corner permutation, all 18 moves
  uedgeMove: Uint16Array // the eight U and D edges' permutation, phase-2 moves
  spermMove: Uint8Array // the four slice edges' permutation, phase-2 moves
  edge4Move: Uint16Array // slots of any four named edges, all 18 moves
  prune1Twist: Int8Array // slice x twist  -> cost to reach G1
  prune1Flip: Int8Array // slice x flip
  prune1TwistFlip: Int8Array // twist x flip
  prune2Corner: Int8Array // slice perm x corner perm -> cost to solved inside G1
  prune2Edge: Int8Array // slice perm x edge perm
}

// Extra lower bounds for the optimal search, over the whole cube.
interface ProofTables {
  edge3Move: Uint16Array // slots of any three named edges
  pruneCorners: Int8Array // corner permutation -> cost
  pruneEdges6: Int8Array // slots of UR UF UL x slots of UB DR DF -> cost
  pruneSlice: Int8Array // slots of FR FL BL BR -> cost
}

let tables: Tables | null = null
let proofTables: ProofTables | null = null

function buildMoveTable<T extends Uint8Array | Uint16Array>(
  out: T,
  size: number,
  moves: number[],
  step: (coord: number, move: number) => number,
): T {
  for (let c = 0; c < size; c++) for (const m of moves) out[c * N_MOVES + m] = step(c, m)
  return out
}

/**
 * Search outward from the goal over combined coordinates, recording the exact
 * COST still needed (quarter turn 1, half turn 2). Moves can be undone at the
 * same cost, so the distance from the goal equals the distance to it.
 *
 * It is breadth-first by cost level. A half turn can reach a state at level
 * d + 2 before a quarter turn from another state reaches it at d + 1, so a
 * state's level is lowered when a cheaper way turns up.
 */
function buildPrune(
  n1: number,
  n2: number,
  move1: Uint8Array | Uint16Array,
  move2: Uint8Array | Uint16Array,
  moves: number[],
  goal1: number,
  goal2: number,
): Int8Array {
  const dist = new Int8Array(n1 * n2).fill(-1)
  dist[goal1 * n2 + goal2] = 0
  const costs = moves.map(quarterCost)
  let deepest = 0
  for (let level = 0; level <= deepest; level++) {
    for (let i = 0; i < dist.length; i++) {
      if (dist[i] !== level) continue
      const a = (i / n2) | 0
      const b = i - a * n2
      for (let k = 0; k < moves.length; k++) {
        const m = moves[k]
        const next = move1[a * N_MOVES + m] * n2 + move2[b * N_MOVES + m]
        const cost = level + costs[k]
        if (dist[next] < 0 || dist[next] > cost) {
          dist[next] = cost
          if (cost > deepest) deepest = cost
        }
      }
    }
  }
  return dist
}

/** A one-coordinate table, built as a pair with a dummy coordinate that never moves. */
const STILL = new Uint16Array(N_MOVES)
const buildPrune1 = (n: number, move: Uint16Array, goal: number) => buildPrune(1, n, STILL, move, ALL_MOVES, 0, goal)

/** Builds the two-phase move and pruning tables once. Safe to call repeatedly. */
export function initTwoPhase(): void {
  if (tables) return
  buildTwoPhaseTables()
}

function buildTwoPhaseTables(): void {
  const { twistMove, flipMove, sliceMove } = phase1Moves()
  const cpermMove = buildMoveTable(new Uint16Array(N_PERM8 * N_MOVES), N_PERM8, ALL_MOVES, (r, m) => {
    const cp = permUnrank(r, 8)
    return permRank(cp.map((_, c) => cp[MOVES[m].cp[c]]), 8)
  })
  const uedgeMove = buildMoveTable(new Uint16Array(N_PERM8 * N_MOVES), N_PERM8, PHASE2_MOVES, (r, m) => {
    const ep = permUnrank(r, 8)
    return permRank(ep.map((_, e) => ep[MOVES[m].ep[e]]), 8)
  })
  const spermMove = buildMoveTable(new Uint8Array(N_PERM4 * N_MOVES), N_PERM4, PHASE2_MOVES, (r, m) => {
    const sp = permUnrank(r, 4)
    return permRank([0, 1, 2, 3].map((e) => sp[MOVES[m].ep[8 + e] - 8]), 4)
  })
  const edge4Move = subsetMove(4)

  tables = {
    twistMove,
    flipMove,
    sliceMove,
    cpermMove,
    uedgeMove,
    spermMove,
    edge4Move,
    prune1Twist: buildPrune(N_SLICE, N_TWIST, sliceMove, twistMove, ALL_MOVES, SLICE_GOAL, 0),
    prune1Flip: buildPrune(N_SLICE, N_FLIP, sliceMove, flipMove, ALL_MOVES, SLICE_GOAL, 0),
    prune1TwistFlip: buildPrune(N_TWIST, N_FLIP, twistMove, flipMove, ALL_MOVES, 0, 0),
    prune2Corner: buildPrune(N_PERM4, N_PERM8, spermMove, cpermMove, PHASE2_MOVES, 0, 0),
    prune2Edge: buildPrune(N_PERM4, N_PERM8, spermMove, uedgeMove, PHASE2_MOVES, 0, 0),
  }
}

function subsetMove(k: number): Uint16Array {
  return buildMoveTable(new Uint16Array(12 ** k * N_MOVES), 12 ** k, ALL_MOVES, (code, m) => {
    let out = 0
    let place = 1
    for (let i = 0; i < k; i++) {
      out += SLOT_AFTER[m][((code / place) | 0) % 12] * place
      place *= 12
    }
    return out
  })
}

export function isTwoPhaseReady(): boolean {
  return tables !== null
}

/**
 * The optimal search's extra tables. Only the worker that answers Solve needs
 * them; the two-phase search runs without, so helpers skip this cost.
 */
export function initProofTables(): void {
  initTwoPhase()
  if (!proofTables) buildProofTables()
}

function buildProofTables(): void {
  const t = tables!
  const edge3Move = subsetMove(3)
  proofTables = {
    edge3Move,
    pruneCorners: buildPrune1(N_PERM8, t.cpermMove, 0),
    pruneEdges6: buildPrune(N_EDGE3, N_EDGE3, edge3Move, edge3Move, ALL_MOVES, edgeSlotsOf(SOLVED.ep, EDGES_A), edgeSlotsOf(SOLVED.ep, EDGES_B)),
    pruneSlice: buildPrune1(N_EDGE4, t.edge4Move, edgeSlotsOf(SOLVED.ep, SLICE_EDGES)),
  }
}

/** What the tables cost: bytes held, by table, for the research report. */
export function tableBytes(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [name, value] of Object.entries({ ...tables, ...proofTables })) out[name] = (value as ArrayBufferView).byteLength
  const p1 = getPhase1Table()
  if (p1) for (const [name, value] of Object.entries(p1)) out[`phase1.${name}`] = (value as ArrayBufferView).byteLength
  const m = phase1Moves()
  out.twistMove = m.twistMove.byteLength
  out.flipMove = m.flipMove.byteLength
  out.sliceMove = m.sliceMove.byteLength
  return out
}
export { phase1TableBuildMs, N_PHASE1 }

// ---- Moves as text -------------------------------------------------------
const moveName = (m: number) => FACE_LETTERS[(m / 3) | 0] + ['', '2', "'"][m % 3]
const costOf = (path: number[]) => path.reduce((n, m) => n + quarterCost(m), 0)
const MOVE_PATTERN = /([URFDLB])(2'?|')?/g

/** Face turns only: letters U R F D L B, each optionally followed by ' or 2. */
function movesOf(alg: string): number[] {
  const out: number[] = []
  for (const [, letter, suffix] of alg.matchAll(MOVE_PATTERN)) {
    out.push(FACE_LETTERS.indexOf(letter) * 3 + (!suffix ? 0 : suffix === "'" ? 2 : 1))
  }
  return out
}

// ---- Points of view --------------------------------------------------------
// A cube looks equally hard from any side, but the search walks different paths
// through each view, so each is a fresh chance at a cheaper answer:
//   * relabel the faces by a 3-fold turn about the URF corner (U>R>F>U, D>L>B>D),
//     0, 1 or 2 times -- the same cube seen from three sides;
//   * solve the INVERSE problem and invert the answer: if S undoes the inverse
//     of the scramble, S's inverse undoes the scramble.
const CORNER_TURN = [1, 2, 0, 4, 5, 3] // U->R, R->F, F->U, D->L, L->B, B->D (face indices)
const CORNER_TURN_BACK = [2, 0, 1, 5, 3, 4]
const relabelMove = (m: number, map: number[]) => map[(m / 3) | 0] * 3 + (m % 3)
const invertMove = (m: number) => m - (m % 3) + (2 - (m % 3))
const invertPath = (path: number[]) => path.slice().reverse().map(invertMove)

interface View {
  start: Cubie
  /** Turns a solution of this view back into a solution of the real cube. */
  toReal: (path: number[]) => number[]
}

function viewsOf(moves: number[]): View[] {
  const views: View[] = []
  for (const inverse of [false, true]) {
    let seen = inverse ? invertPath(moves) : moves
    for (let turns = 0; turns < 3; turns++) {
      const t = turns
      views.push({
        start: applyMoves(SOLVED, seen),
        toReal: (path) => {
          let real = path
          for (let i = 0; i < t; i++) real = real.map((m) => relabelMove(m, CORNER_TURN_BACK))
          return inverse ? invertPath(real) : real
        },
      })
      seen = seen.map((m) => relabelMove(m, CORNER_TURN))
    }
  }
  return views
}

/** Cost of the cheapest route that is still worth finding: under `bound`, and of the right parity. */
function lastUsefulCost(bound: number, parity: number): number {
  if (bound === Infinity) return Infinity
  let lim = bound - 1
  if (((lim - parity) & 1) !== 0) lim--
  return lim
}

// ---- Improving search ------------------------------------------------------
const STACK = 64
const MAX_THRESHOLD = 40

interface Root {
  tw: number
  fl: number
  sl: number
  /** Lower bound on the phase-1 cost (exact when the exact table is in use). */
  h: number
}

/**
 * A two-phase search that can be paused, resumed and stopped at any moment.
 *
 * It works through the six views one cost level at a time (every view at cost
 * 0, then every view at cost 1, ...), and inside a level it is an ordinary
 * depth-first search -- but kept on an explicit stack instead of the call
 * stack, so `run()` can hand control back after a few milliseconds and carry on
 * later exactly where it left off. That is what lets the guide keep improving
 * its route in the background while you play, and drop the work the instant
 * you move.
 *
 * Phase 1 is pruned by the cost to reach G1 against the current level (the
 * usual IDA* rule): the exact cost if the exact table was ready when the job
 * was made, else the largest of three smaller tables. Phase 2's coordinates
 * are only needed where phase 1 ends, so they are read off the actual cube at
 * that point rather than carried for every node.
 *
 * If every useful level below the best cost is exhausted, nothing cheaper
 * exists: the best solution is provably optimal (`exhausted`).
 */
export class RefineJob {
  /** Cheapest solution so far, as move numbers (see moveName), or null. */
  best: number[] | null = null
  bestCost: number
  /** Every cost below `bestCost` has been ruled out, so the best solution is optimal. */
  exhausted = false
  /** Called each time a cheaper solution turns up. */
  onImprove: ((path: number[], cost: number) => void) | null = null

  /**
   * Someone else (another worker searching other views) found a route costing
   * `cost`: only strictly cheaper ones are worth looking for now.
   */
  tighten(cost: number): void {
    if (cost < this.bestCost) {
      this.bestCost = cost
      this.useful = lastUsefulCost(cost, this.parity)
    }
  }

  private readonly views: View[]
  private readonly roots: Root[]
  private readonly exact: Phase1Table | null
  /** Every solution of this cube costs an even (0) or odd (1) number of quarter turns. */
  private readonly parity: number
  private useful: number
  private threshold = 0
  private viewIndex = 0
  private active = false
  private depth = 0
  // The depth-first stack: one entry per depth.
  private readonly tw = new Int32Array(STACK)
  private readonly fl = new Int32Array(STACK)
  private readonly sl = new Int32Array(STACK)
  private readonly h = new Int32Array(STACK)
  private readonly chain = new Int32Array(STACK) // phase-1 cost after the last sibling turn of the same face
  private readonly spent = new Int32Array(STACK)
  private readonly last = new Int32Array(STACK)
  private readonly next = new Int32Array(STACK)
  private readonly fresh = new Uint8Array(STACK)
  private readonly taken = new Int32Array(STACK) // the move made from each depth
  private readonly tail = new Int32Array(STACK) // phase-2 moves under construction
  private tailLength = 0

  /** `bound`: only solutions costing strictly less than this are wanted. */
  constructor(views: View[], bound = Infinity) {
    initTwoPhase()
    const t = tables!
    this.views = views
    this.bestCost = bound
    this.exact = getPhase1Table()
    this.parity = parityOf(views[0].start.cp)
    this.useful = lastUsefulCost(bound, this.parity)
    this.roots = views.map((v) => {
      const tw = twistOf(v.start.co)
      const fl = flipOf(v.start.eo)
      const sl = slicePositionOf(v.start.ep)
      return { tw, fl, sl, h: this.exact ? phase1Cost(this.exact, tw, fl, sl) : smallPhase1Bound(t, tw, fl, sl) }
    })
  }

  /** Advance for about `budgetMs`. Returns true once the search is finished. */
  run(budgetMs: number): boolean {
    const t = tables!
    const ex = this.exact
    const cost3 = ex?.cost3
    const fsClass = ex?.fsClass
    const fsSym = ex?.fsSym
    const twistConj = ex?.twistConj
    const deadline = performance.now() + budgetMs
    let nodes = 0
    for (;;) {
      if (this.exhausted) return true
      if (!this.active) {
        if (this.threshold > this.useful || this.threshold > MAX_THRESHOLD) {
          this.exhausted = true
          return true
        }
        this.begin()
      }
      const threshold = this.threshold
      while (this.depth >= 0) {
        if ((++nodes & 1023) === 0 && performance.now() > deadline) return false
        const d = this.depth
        if (this.fresh[d]) {
          this.fresh[d] = 0
          const spent = this.spent[d]
          const g1 = this.h[d]
          if (spent + g1 > threshold) {
            this.depth--
            continue
          }
          if (g1 === 0 && spent === threshold) {
            // Ending on a phase-2 move would just be a cheaper phase 1 plus that move.
            if (this.last[d] < 0 || !isPhase2Move(this.last[d])) this.leaf(d)
            this.depth--
            continue
          }
          this.next[d] = 0
        }
        const row = (this.last[d] + 1) * N_MOVES
        let m = this.next[d]
        while (m < N_MOVES && !ALLOWED[row + m]) m += 3
        if (m >= N_MOVES) {
          this.depth--
          continue
        }
        this.next[d] = m + 1
        const tw = t.twistMove[this.tw[d] * N_MOVES + m]
        const fl = t.flipMove[this.fl[d] * N_MOVES + m]
        const sl = t.sliceMove[this.sl[d] * N_MOVES + m]
        let hc: number
        if (ex) {
          // Exact cost from the cost one quarter turn back: R from the cube, R2
          // from R, R' from R2 (the turns of a face come in that order).
          const fs = sl * N_FLIP + fl
          const i = fsClass![fs] * N_TWIST + twistConj![tw * N_SYM_UD + fsSym![fs]]
          const after = (cost3![i >>> 4] >>> ((i & 15) << 1)) & 3
          const before = m % 3 === 0 ? this.h[d] : this.chain[d]
          const delta = (after - before + 3) % 3
          hc = delta === 0 ? before : delta === 1 ? before + 1 : before - 1
          this.chain[d] = hc
        } else {
          hc = smallPhase1Bound(t, tw, fl, sl)
        }
        const spent = this.spent[d] + (m % 3 === 1 ? 2 : 1)
        if (spent + hc > threshold) continue
        const c = d + 1
        this.taken[d] = m
        this.tw[c] = tw
        this.fl[c] = fl
        this.sl[c] = sl
        this.h[c] = hc
        this.spent[c] = spent
        this.last[c] = m
        this.fresh[c] = 1
        this.depth = c
      }
      // This view finished this level; on to the next view, then the next level.
      this.active = false
      if (++this.viewIndex === this.views.length) {
        this.viewIndex = 0
        this.threshold++
      }
    }
  }

  private begin(): void {
    const r = this.roots[this.viewIndex]
    this.depth = 0
    this.tw[0] = r.tw
    this.fl[0] = r.fl
    this.sl[0] = r.sl
    this.h[0] = r.h
    this.spent[0] = 0
    this.last[0] = -1
    this.fresh[0] = 1
    this.active = true
  }

  // A phase-1 ending at depth d: find the cheapest way to finish inside G1.
  private leaf(d: number): void {
    const t = tables!
    const view = this.views[this.viewIndex]
    const head = Array.from(this.taken.subarray(0, d))
    let cube = view.start
    for (const m of head) cube = multiply(cube, MOVES[m])
    const cp = permRank(cube.cp, 8)
    const ue = permRank(cube.ep.slice(0, 8), 8)
    const sp = permRank(cube.ep.slice(8).map((e) => e - 8), 4)
    const base = this.spent[d]
    const last = d > 0 ? head[d - 1] : -1
    const floor = Math.max(t.prune2Corner[sp * N_PERM8 + cp], t.prune2Edge[sp * N_PERM8 + ue])
    if (base + floor >= this.bestCost) return
    this.tailLength = 0
    if (this.bestCost === Infinity) {
      // No solution yet: any one will do, so deepen phase 2 until one appears.
      for (let limit = floor; !this.phase2First(d, cp, ue, sp, 0, limit, last); limit++);
    } else {
      this.phase2Better(d, cp, ue, sp, 0, last)
    }
  }

  private record(d: number, cost: number): void {
    const path = [...this.taken.subarray(0, d), ...this.tail.subarray(0, this.tailLength)]
    const real = this.views[this.viewIndex].toReal(path)
    this.best = real
    this.bestCost = cost
    this.useful = lastUsefulCost(cost, this.parity)
    this.onImprove?.(real, cost)
  }

  // Phase 2 for the first solution: iterative deepening, since there is no bound yet.
  private phase2First(d: number, cp: number, ue: number, sp: number, spent: number, limit: number, last: number): boolean {
    const t = tables!
    const a = t.prune2Corner[sp * N_PERM8 + cp]
    const b = t.prune2Edge[sp * N_PERM8 + ue]
    const h = a > b ? a : b
    if (spent + h > limit) return false
    if (h === 0) {
      this.record(d, this.spent[d] + spent)
      return true
    }
    const row = (last + 1) * N_MOVES
    for (const m of PHASE2_MOVES) {
      if (!ALLOWED[row + m]) continue
      this.tail[this.tailLength++] = m
      const found = this.phase2First(
        d,
        t.cpermMove[cp * N_MOVES + m],
        t.uedgeMove[ue * N_MOVES + m],
        t.spermMove[sp * N_MOVES + m],
        spent + quarterCost(m),
        limit,
        m,
      )
      this.tailLength--
      if (found) return true
    }
    return false
  }

  // Phase 2 once a solution exists: one pass bounded by the best total so far,
  // which tightens each time something better is recorded.
  private phase2Better(d: number, cp: number, ue: number, sp: number, spent: number, last: number): void {
    const t = tables!
    const a = t.prune2Corner[sp * N_PERM8 + cp]
    const b = t.prune2Edge[sp * N_PERM8 + ue]
    const h = a > b ? a : b
    const base = this.spent[d]
    if (base + spent + h >= this.bestCost) return
    if (h === 0) {
      this.record(d, base + spent)
      return
    }
    const row = (last + 1) * N_MOVES
    for (const m of PHASE2_MOVES) {
      if (!ALLOWED[row + m]) continue
      this.tail[this.tailLength++] = m
      this.phase2Better(d, t.cpermMove[cp * N_MOVES + m], t.uedgeMove[ue * N_MOVES + m], t.spermMove[sp * N_MOVES + m], spent + quarterCost(m), m)
      this.tailLength--
    }
  }
}

/** The largest of the three small phase-1 tables: a lower bound on the phase-1 cost. */
function smallPhase1Bound(t: Tables, tw: number, fl: number, sl: number): number {
  const a = t.prune1Twist[sl * N_TWIST + tw]
  const b = t.prune1Flip[sl * N_FLIP + fl]
  const c = t.prune1TwistFlip[tw * N_FLIP + fl]
  return a > b ? (a > c ? a : c) : b > c ? b : c
}

/** Runs a job until it has a first solution, then for up to `extraMs` more. */
function runJob(job: RefineJob, extraMs: number): void {
  const until = performance.now() + extraMs
  while (!job.exhausted) {
    const remaining = until - performance.now()
    if (job.best && remaining <= 0) return
    job.run(job.best ? remaining : 50)
  }
}

// ---- Optimal search --------------------------------------------------------
interface ProofResult {
  /** A solution cheaper than `below`, found in increasing order of cost: the cheapest possible. */
  path: number[] | null
  /** No solution costs less than this. */
  noneBelow: number
}

// AXIS_MOVE[a * 18 + m]: move m as the cube seen along axis a sees it.
const AXIS_MOVE = new Int8Array(3 * N_MOVES)
for (let a = 0; a < 3; a++) for (let m = 0; m < N_MOVES; m++) AXIS_MOVE[a * N_MOVES + m] = CONJ_MOVE[m * N_SYM + AXIS_SYM[a]]

/**
 * IDA* over the whole cube, trying costs from `from` up to (not including)
 * `below`. Every lower bound it uses is exact for part of the cube, so it never
 * over-estimates and the first solution found is the cheapest one there is.
 *
 * Its main bound is the phase-1 cost seen along each of the three axes: the
 * cube, and the cube turned so that its R-L axis, then its F-B axis, is
 * vertical. Each is the cost of reaching a subgroup that the solved cube is in,
 * so each is a lower bound, and so is the largest. Costs are rounded up to the
 * parity every solution of the cube has, and only levels of that parity are
 * searched.
 */
function proveOptimal(start: Cubie, below: number, from: number, timeMs: number): ProofResult {
  initProofTables()
  const t = tables!
  const p = proofTables!
  const ex = getPhase1Table()
  const deadline = performance.now() + timeMs
  let nodes = 0
  let timeUp = false
  const path: number[] = []
  const parity = parityOf(start.cp)

  const MAXD = STACK
  const tw = new Int32Array(MAXD * 3)
  const fl = new Int32Array(MAXD * 3)
  const sl = new Int32Array(MAXD * 3)
  const h1 = new Int32Array(MAXD * 3)
  const chain = new Int32Array(MAXD * 3)
  const cp = new Int32Array(MAXD)
  const ea = new Int32Array(MAXD)
  const eb = new Int32Array(MAXD)
  const s4 = new Int32Array(MAXD)

  for (let a = 0; a < 3; a++) {
    const seen = conjugate(start, AXIS_SYM[a])
    tw[a] = twistOf(seen.co)
    fl[a] = flipOf(seen.eo)
    sl[a] = slicePositionOf(seen.ep)
    h1[a] = ex ? phase1Cost(ex, tw[a], fl[a], sl[a]) : smallPhase1Bound(t, tw[a], fl[a], sl[a])
  }
  cp[0] = permRank(start.cp, 8)
  ea[0] = edgeSlotsOf(start.ep, EDGES_A)
  eb[0] = edgeSlotsOf(start.ep, EDGES_B)
  s4[0] = edgeSlotsOf(start.ep, SLICE_EDGES)
  const others = (k: number) => {
    const c = p.pruneCorners[cp[k]]
    const e = p.pruneEdges6[ea[k] * N_EDGE3 + eb[k]]
    const s = p.pruneSlice[s4[k]]
    return c > e ? (c > s ? c : s) : e > s ? e : s
  }
  // Round a lower bound on the cost from here up to the parity it must have.
  const withParity = (bound: number, spent: number) => bound + ((bound + spent + parity) & 1)

  let threshold = 0
  // When every bound is 0 the cube is solved: twist, flip, all corner places,
  // and ten edge places are right, which leaves the last two edges no choice
  // (swapping only them would break the parity that the corners pin down).
  function dfs(k: number, spent: number, last: number): boolean {
    if ((++nodes & 2047) === 0 && performance.now() > deadline) timeUp = true
    if (timeUp) return false
    const row = (last + 1) * N_MOVES
    const c = k + 1
    for (let m = 0; m < N_MOVES; m++) {
      if (!ALLOWED[row + m]) {
        m += 2 // the three turns of a face are allowed or not together
        continue
      }
      let h = 0
      for (let a = 0; a < 3; a++) {
        const ma = AXIS_MOVE[a * N_MOVES + m]
        const j = k * 3 + a
        const tw1 = t.twistMove[tw[j] * N_MOVES + ma]
        const fl1 = t.flipMove[fl[j] * N_MOVES + ma]
        const sl1 = t.sliceMove[sl[j] * N_MOVES + ma]
        let ha: number
        if (ex) {
          const fs = sl1 * N_FLIP + fl1
          const i = ex.fsClass[fs] * N_TWIST + ex.twistConj[tw1 * N_SYM_UD + ex.fsSym[fs]]
          const after = (ex.cost3[i >>> 4] >>> ((i & 15) << 1)) & 3
          const before = m % 3 === 0 ? h1[j] : chain[j]
          const delta = (after - before + 3) % 3
          ha = delta === 0 ? before : delta === 1 ? before + 1 : before - 1
          chain[j] = ha
        } else {
          ha = smallPhase1Bound(t, tw1, fl1, sl1)
        }
        const jc = c * 3 + a
        tw[jc] = tw1
        fl[jc] = fl1
        sl[jc] = sl1
        h1[jc] = ha
        if (ha > h) h = ha
      }
      cp[c] = t.cpermMove[cp[k] * N_MOVES + m]
      ea[c] = p.edge3Move[ea[k] * N_MOVES + m]
      eb[c] = p.edge3Move[eb[k] * N_MOVES + m]
      s4[c] = t.edge4Move[s4[k] * N_MOVES + m]
      const o = others(c)
      if (o > h) h = o
      const sc = spent + quarterCost(m)
      h = withParity(h, sc)
      if (sc + h > threshold) continue
      path.push(m)
      if (h === 0 || dfs(c, sc, m)) return true
      path.pop()
      if (timeUp) return false
    }
    return false
  }

  let root = others(0)
  for (let a = 0; a < 3; a++) if (h1[a] > root) root = h1[a]
  if (root === 0) return { path: [], noneBelow: 0 }
  // `from` is a proven lower bound; so is the root's estimate. Solutions all
  // have the cube's parity, so the first level worth searching has it too.
  const floor = withParity(Math.max(from, root), 0)
  for (threshold = floor; threshold < below; threshold += 2) {
    path.length = 0
    if (dfs(0, 0, -1)) return { path: path.slice(), noneBelow: costOf(path) }
    if (timeUp) return { path: null, noneBelow: threshold }
  }
  // Every level of the right parity below `threshold` is empty.
  return { path: null, noneBelow: threshold }
}

// ---- Public API ----------------------------------------------------------
export interface SolveOptions {
  /** How long the two-phase search keeps hunting for cheaper answers. Default 1500 ms. */
  timeMs?: number
  /** How long the optimal search may spend trying to prove (or beat) that answer. Default 600 ms. */
  proveMs?: number
  /** A cost already achievable some other way: the proof only needs to look below it. */
  bound?: number
}

export interface SolveResult {
  /** Face turns, e.g. "R U2 F'". Empty when the cube is already solved. */
  solution: string
  /** Its cost in quarter turns (the guide's step count). */
  cost: number
  /** No solution of any kind costs less than this; when it equals `cost`, the solution is optimal. */
  noneBelow: number
}

/**
 * The shortest solution this solver can find for the cube reached by
 * `scramble` (face turns), and how much of the search space below it has been
 * ruled out.
 */
export function solveDetailed(scramble: string, options: SolveOptions = {}): SolveResult {
  initTwoPhase()
  const moves = movesOf(scramble)
  const start = applyMoves(SOLVED, moves)
  if (isSolvedCubie(start)) return { solution: '', cost: 0, noneBelow: 0 }
  const proveMs = options.proveMs ?? 600
  const outside = options.bound ?? Infinity
  const done = (path: number[], noneBelow: number): SolveResult => ({
    solution: path.map(moveName).join(' '),
    cost: costOf(path),
    noneBelow,
  })

  // 1. Near-solved cubes are solved optimally outright, in a blink.
  const quick = proveOptimal(start, outside, 0, Math.min(proveMs, 150))
  if (quick.path) return done(quick.path, quick.noneBelow)

  // 2. Two-phase from six views for the time budget.
  const job = new RefineJob(viewsOf(moves))
  runJob(job, options.timeMs ?? 1500)
  const best = job.best!
  // Every level below the best was ruled out: it is optimal.
  if (job.exhausted) return done(best, costOf(best))

  // 3. Spend what is left trying to beat it, or to prove nothing can.
  const below = Math.min(costOf(best), outside)
  const proof = proveOptimal(start, below, quick.noneBelow, Math.max(0, proveMs - 150))
  if (proof.path) return done(proof.path, proof.noneBelow)
  return done(best, Math.min(proof.noneBelow, costOf(best)))
}

/**
 * A short solution (as face turns) for the cube reached by `scramble`. Returns
 * "" when the cube is already solved. Two-phase only, no proof.
 */
export function solveTwoPhase(scramble: string, options: { timeMs?: number } = {}): string {
  initTwoPhase()
  const moves = movesOf(scramble)
  if (isSolvedCubie(applyMoves(SOLVED, moves))) return ''
  const job = new RefineJob(viewsOf(moves))
  runJob(job, options.timeMs ?? 1500)
  return job.best!.map(moveName).join(' ')
}

/**
 * A search that keeps improving a solution in slices, for the background
 * refiner: call `run(ms)` repeatedly, stop whenever you like.
 */
export function createRefineJob(scramble: string, bound?: number, slice?: { index: number; count: number }): RefineJob {
  const views = viewsOf(movesOf(scramble))
  // Several workers can split the six views between them: worker i of n takes
  // views i, i + n, i + 2n, ...
  return new RefineJob(slice ? views.filter((_, i) => i % slice.count === slice.index) : views, bound)
}

/** A solution as text, e.g. "R U2 F'". */
export const pathToText = (path: number[]) => path.map(moveName).join(' ')
export const costOfPath = costOf

// ---- Random scrambles ------------------------------------------------------
/** A uniformly random integer in [0, n), from the browser's cryptographic generator. */
function randomBelow(n: number): number {
  const buffer = new Uint32Array(1)
  const limit = Math.floor(2 ** 32 / n) * n // reject the uneven tail so every value is equally likely
  do crypto.getRandomValues(buffer)
  while (buffer[0] >= limit)
  return buffer[0] % n
}

function randomPermutation(n: number, below: (n: number) => number): number[] {
  const p = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = below(i + 1)
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  return p
}

/**
 * A cube state drawn uniformly from all 43,252,003,274,489,856,000 reachable
 * ones: random corner and edge arrangements with matching parity, random
 * twists summing to a multiple of 3, random flips summing to a multiple of 2.
 *
 * `below(n)` must return a uniformly random integer in [0, n). It defaults to
 * the cryptographic generator; tests and experiments pass a seeded one so a
 * run can be repeated.
 */
export function randomCubie(below: (n: number) => number = randomBelow): Cubie {
  const cp = randomPermutation(8, below)
  const ep = randomPermutation(12, below)
  // Corner and edge parity must agree; swapping the last two edges pairs every
  // odd arrangement with exactly one even one, so the result stays uniform.
  if (parityOf(cp) !== parityOf(ep)) [ep[10], ep[11]] = [ep[11], ep[10]]
  const co = Array.from({ length: 7 }, () => below(3))
  co.push((3 - (co.reduce((a, b) => a + b, 0) % 3)) % 3)
  const eo = Array.from({ length: 11 }, () => below(2))
  eo.push(eo.reduce((a, b) => a + b, 0) % 2)
  return { cp, co, ep, eo }
}

/**
 * A random-state scramble: pick a uniformly random cube, solve it, and play
 * the solution backwards. Applying the result to a solved cube makes exactly
 * that random cube. (Same method as official competition scramblers.)
 */
export function randomScramble(): string {
  for (;;) {
    const target = randomCubie()
    if (isSolvedCubie(target)) continue
    const scramble = scrambleFor(target)
    // A random cube needs about 20 turns; a much shorter one is a rare easy
    // cube, so draw again rather than hand out an easy scramble.
    if (scramble.split(' ').length < 16) continue
    return scramble
  }
}

/**
 * Face turns that make `target` from a solved cube ("" if it is solved): solve
 * it, searching for `timeMs` after the first answer, and play that backwards.
 * `target` must be a reachable cube: for any other the search may never end.
 */
export function scrambleFor(target: Cubie, timeMs = 250): string {
  initTwoPhase()
  if (isSolvedCubie(target)) return ''
  const job = new RefineJob([{ start: target, toReal: (p) => p }])
  runJob(job, timeMs)
  return invertPath(job.best!).map(moveName).join(' ')
}

