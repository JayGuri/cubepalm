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
// for every pair of coordinates, the exact cost still needed, found once by a
// breadth-first search. A table value never over-estimates, so cutting a branch
// whose value exceeds what is left to spend never loses a solution.
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
// every cost below the answer, which proves it optimal. That is quick for cubes
// a dozen or so steps from solved -- the end of every guided solve -- and gives
// up gracefully on fully scrambled cubes, where a proof would take hours.

/** Moves are numbered face * 3 + (0: clockwise, 1: half turn, 2: counter-clockwise). */
const FACE_LETTERS = 'URFDLB'
const N_MOVES = 18

// ---- Cubie model ---------------------------------------------------------
// Corners: URF UFL ULB UBR DFR DLF DBL DRB.  Edges: UR UF UL UB DR DF DL DB FR FL BL BR.
export interface Cubie {
  cp: number[] // which corner sits in each corner slot
  co: number[] // its twist, 0..2
  ep: number[] // which edge sits in each edge slot
  eo: number[] // its flip, 0..1
}

const [URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB] = [0, 1, 2, 3, 4, 5, 6, 7]
const [UR, UF, UL, UB, DR, DF, DL, DB, FR, FL, BL, BR] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const zeros = (n: number) => new Array<number>(n).fill(0)

// The six clockwise quarter turns, as permutations plus orientation changes.
const BASIC_MOVES: Cubie[] = [
  // U
  { cp: [UBR, URF, UFL, ULB, DFR, DLF, DBL, DRB], co: zeros(8), ep: [UB, UR, UF, UL, DR, DF, DL, DB, FR, FL, BL, BR], eo: zeros(12) },
  // R
  { cp: [DFR, UFL, ULB, URF, DRB, DLF, DBL, UBR], co: [2, 0, 0, 1, 1, 0, 0, 2], ep: [FR, UF, UL, UB, BR, DF, DL, DB, DR, FL, BL, UR], eo: zeros(12) },
  // F
  { cp: [UFL, DLF, ULB, UBR, URF, DFR, DBL, DRB], co: [1, 2, 0, 0, 2, 1, 0, 0], ep: [UR, FL, UL, UB, DR, FR, DL, DB, UF, DF, BL, BR], eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0] },
  // D
  { cp: [URF, UFL, ULB, UBR, DLF, DBL, DRB, DFR], co: zeros(8), ep: [UR, UF, UL, UB, DF, DL, DB, DR, FR, FL, BL, BR], eo: zeros(12) },
  // L
  { cp: [URF, ULB, DBL, UBR, DFR, UFL, DLF, DRB], co: [0, 1, 2, 0, 0, 2, 1, 0], ep: [UR, UF, BL, UB, DR, DF, FL, DB, FR, UL, DL, BR], eo: zeros(12) },
  // B
  { cp: [URF, UFL, UBR, DRB, DFR, DLF, ULB, DBL], co: [0, 0, 1, 2, 0, 0, 2, 1], ep: [UR, UF, UL, BR, DR, DF, DL, BL, FR, FL, UB, DB], eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1] },
]

const SOLVED: Cubie = {
  cp: [0, 1, 2, 3, 4, 5, 6, 7],
  co: zeros(8),
  ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  eo: zeros(12),
}

/** `a` then `b`. */
function multiply(a: Cubie, b: Cubie): Cubie {
  const cp: number[] = []
  const co: number[] = []
  const ep: number[] = []
  const eo: number[] = []
  for (let c = 0; c < 8; c++) {
    cp[c] = a.cp[b.cp[c]]
    co[c] = (a.co[b.cp[c]] + b.co[c]) % 3
  }
  for (let e = 0; e < 12; e++) {
    ep[e] = a.ep[b.ep[e]]
    eo[e] = (a.eo[b.ep[e]] + b.eo[e]) % 2
  }
  return { cp, co, ep, eo }
}

// All 18 moves: each face turned once, twice and three times.
const MOVES: Cubie[] = []
for (let f = 0; f < 6; f++) {
  let m = BASIC_MOVES[f]
  for (let p = 0; p < 3; p++) {
    MOVES.push(m)
    m = multiply(m, BASIC_MOVES[f])
  }
}
const ALL_MOVES = Array.from({ length: N_MOVES }, (_, i) => i)

/** Phase 2 may only use U D (any turn) and half turns of R L F B. */
const PHASE2_MOVES = [0, 1, 2, 9, 10, 11, 4, 7, 13, 16]
const isPhase2Move = (m: number) => {
  const face = (m / 3) | 0
  return face === 0 || face === 3 || m % 3 === 1
}

const quarterCost = (m: number) => (m % 3 === 1 ? 2 : 1)

// A move may not repeat the last face, and of two opposite faces only the
// U-before-D order is allowed (R L and L R reach the same place). Indexed by
// (last move + 1) * 18 + move, so "no last move" is row 0.
const ALLOWED = new Uint8Array(19 * N_MOVES)
for (let last = -1; last < N_MOVES; last++) {
  for (let m = 0; m < N_MOVES; m++) {
    const f = (m / 3) | 0
    const lf = last < 0 ? -9 : (last / 3) | 0
    ALLOWED[(last + 1) * N_MOVES + m] = f !== lf && f + 3 !== lf ? 1 : 0
  }
}

const isSolvedCubie = (c: Cubie) =>
  c.cp.every((v, i) => v === i) && c.ep.every((v, i) => v === i) && c.co.every((v) => v === 0) && c.eo.every((v) => v === 0)

// ---- Coordinates ---------------------------------------------------------
const N_TWIST = 2187
const N_FLIP = 2048
const N_SLICE = 495
const N_PERM8 = 40320
const N_PERM4 = 24
const N_EDGE3 = 12 ** 3 // slots of three named edges, written in base 12
const N_EDGE4 = 12 ** 4 // slots of four named edges

const FACTORIAL = [1, 1, 2, 6, 24, 120, 720, 5040, 40320]
const choose = (n: number, k: number) => {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return r
}

const twistOf = (co: number[]) => co.slice(0, 7).reduce((t, v) => t * 3 + v, 0)
const flipOf = (eo: number[]) => eo.slice(0, 11).reduce((t, v) => t * 2 + v, 0)

function twistToCo(t: number): number[] {
  const co = zeros(8)
  let sum = 0
  for (let i = 6; i >= 0; i--) {
    co[i] = t % 3
    sum += co[i]
    t = (t / 3) | 0
  }
  co[7] = (3 - (sum % 3)) % 3
  return co
}

function flipToEo(t: number): number[] {
  const eo = zeros(12)
  let sum = 0
  for (let i = 10; i >= 0; i--) {
    eo[i] = t % 2
    sum += eo[i]
    t = (t / 2) | 0
  }
  eo[11] = sum % 2
  return eo
}

/** Which 4 of the 12 edge slots hold slice edges (values 8..11): a number 0..494. */
function slicePositionOf(ep: number[]): number {
  let rank = 0
  let k = 1
  for (let slot = 0; slot < 12; slot++) {
    if (ep[slot] >= 8) rank += choose(slot, k++)
  }
  return rank
}

/** A representative edge arrangement for a slice position (slice slots hold 8, the rest 0). */
function sliceToEp(rank: number): number[] {
  const ep = zeros(12)
  for (let k = 4; k >= 1; k--) {
    let slot = 11
    while (choose(slot, k) > rank) slot--
    rank -= choose(slot, k)
    ep[slot] = 8
  }
  return ep
}

/** Position of a permutation among all n! permutations (Lehmer code). */
function permRank(p: number[], n: number): number {
  let rank = 0
  for (let i = 0; i < n - 1; i++) {
    let smaller = 0
    for (let j = i + 1; j < n; j++) if (p[j] < p[i]) smaller++
    rank += smaller * FACTORIAL[n - 1 - i]
  }
  return rank
}

function permUnrank(rank: number, n: number): number[] {
  const free = Array.from({ length: n }, (_, i) => i)
  const p: number[] = []
  for (let i = 0; i < n; i++) {
    const f = FACTORIAL[n - 1 - i]
    const idx = (rank / f) | 0
    rank -= idx * f
    p.push(free.splice(idx, 1)[0])
  }
  return p
}

// Where an edge in slot s goes after move m. (A move sends the piece in slot
// MOVES[m].ep[e] to slot e.)
const SLOT_AFTER: number[][] = MOVES.map((mv) => {
  const out = zeros(12)
  for (let e = 0; e < 12; e++) out[mv.ep[e]] = e
  return out
})

/** The slots holding the given edges, as one base-12 number. */
function edgeSlotsOf(ep: number[], ids: number[]): number {
  let code = 0
  let place = 1
  for (const id of ids) {
    code += ep.indexOf(id) * place
    place *= 12
  }
  return code
}

// ---- Tables --------------------------------------------------------------
interface Tables {
  twistMove: Uint16Array
  flipMove: Uint16Array
  sliceMove: Uint16Array
  cpermMove: Uint16Array
  uedgeMove: Uint16Array
  spermMove: Uint8Array
  prune1Twist: Int8Array // slice x twist  -> cost to reach G1
  prune1Flip: Int8Array // slice x flip
  prune1TwistFlip: Int8Array // twist x flip
  prune2Corner: Int8Array // slice perm x corner perm -> cost to solved inside G1
  prune2Edge: Int8Array // slice perm x edge perm
}

// Extra lower bounds for the optimal search, over the whole cube.
interface ProofTables {
  cpermMove: Uint16Array // corner permutation under all 18 moves
  edge3Move: Uint16Array // slots of any three named edges
  edge4Move: Uint16Array // slots of any four named edges
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
  let deepest = 0
  for (let level = 0; level <= deepest; level++) {
    for (let i = 0; i < dist.length; i++) {
      if (dist[i] !== level) continue
      const a = (i / n2) | 0
      const b = i - a * n2
      for (const m of moves) {
        const next = move1[a * N_MOVES + m] * n2 + move2[b * N_MOVES + m]
        const cost = level + quarterCost(m)
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

  const twistMove = buildMoveTable(new Uint16Array(N_TWIST * N_MOVES), N_TWIST, ALL_MOVES, (t, m) => {
    const co = twistToCo(t)
    return twistOf(co.map((_, c) => (co[MOVES[m].cp[c]] + MOVES[m].co[c]) % 3))
  })
  const flipMove = buildMoveTable(new Uint16Array(N_FLIP * N_MOVES), N_FLIP, ALL_MOVES, (t, m) => {
    const eo = flipToEo(t)
    return flipOf(eo.map((_, e) => (eo[MOVES[m].ep[e]] + MOVES[m].eo[e]) % 2))
  })
  const sliceMove = buildMoveTable(new Uint16Array(N_SLICE * N_MOVES), N_SLICE, ALL_MOVES, (r, m) => {
    const ep = sliceToEp(r)
    return slicePositionOf(ep.map((_, e) => ep[MOVES[m].ep[e]]))
  })
  const cpermMove = buildMoveTable(new Uint16Array(N_PERM8 * N_MOVES), N_PERM8, PHASE2_MOVES, (r, m) => {
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

  const sliceGoal = slicePositionOf(SOLVED.ep)
  tables = {
    twistMove,
    flipMove,
    sliceMove,
    cpermMove,
    uedgeMove,
    spermMove,
    prune1Twist: buildPrune(N_SLICE, N_TWIST, sliceMove, twistMove, ALL_MOVES, sliceGoal, 0),
    prune1Flip: buildPrune(N_SLICE, N_FLIP, sliceMove, flipMove, ALL_MOVES, sliceGoal, 0),
    prune1TwistFlip: buildPrune(N_TWIST, N_FLIP, twistMove, flipMove, ALL_MOVES, 0, 0),
    prune2Corner: buildPrune(N_PERM4, N_PERM8, spermMove, cpermMove, PHASE2_MOVES, 0, 0),
    prune2Edge: buildPrune(N_PERM4, N_PERM8, spermMove, uedgeMove, PHASE2_MOVES, 0, 0),
  }
}

export function isTwoPhaseReady(): boolean {
  return tables !== null
}

// Edges grouped for the optimal search's lower bounds.
const EDGES_A = [UR, UF, UL]
const EDGES_B = [UB, DR, DF]
const SLICE_EDGES = [FR, FL, BL, BR]

/**
 * The optimal search's extra tables. Only the worker that answers Solve needs
 * them; the two-phase search runs without, so helpers skip this cost.
 */
export function initProofTables(): void {
  initTwoPhase()
  if (!proofTables) buildProofTables()
}

function buildProofTables(): void {
  const subsetMove = (k: number) =>
    buildMoveTable(new Uint16Array(12 ** k * N_MOVES), 12 ** k, ALL_MOVES, (code, m) => {
      let out = 0
      let place = 1
      for (let i = 0; i < k; i++) {
        out += SLOT_AFTER[m][((code / place) | 0) % 12] * place
        place *= 12
      }
      return out
    })
  const cpermMove = buildMoveTable(new Uint16Array(N_PERM8 * N_MOVES), N_PERM8, ALL_MOVES, (r, m) => {
    const cp = permUnrank(r, 8)
    return permRank(cp.map((_, c) => cp[MOVES[m].cp[c]]), 8)
  })
  const edge3Move = subsetMove(3)
  const edge4Move = subsetMove(4)
  proofTables = {
    cpermMove,
    edge3Move,
    edge4Move,
    pruneCorners: buildPrune1(N_PERM8, cpermMove, 0),
    pruneEdges6: buildPrune(N_EDGE3, N_EDGE3, edge3Move, edge3Move, ALL_MOVES, edgeSlotsOf(SOLVED.ep, EDGES_A), edgeSlotsOf(SOLVED.ep, EDGES_B)),
    pruneSlice: buildPrune1(N_EDGE4, edge4Move, edgeSlotsOf(SOLVED.ep, SLICE_EDGES)),
  }
}

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
        start: seen.reduce((s, m) => multiply(s, MOVES[m]), SOLVED),
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

// ---- Improving search ------------------------------------------------------
const STACK = 64
const MAX_THRESHOLD = 40

interface Root {
  tw: number
  fl: number
  sl: number
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
 * Phase 1 is pruned two ways. By the cost to reach G1 against the current
 * level (the usual IDA* rule), and by a whole-cube lower bound -- the largest
 * of the G1 distance, the corner permutation, six edges and the slice edges --
 * against the best total found so far. That second rule cuts branches that
 * could reach G1 but could never finish cheaper than what is already in hand.
 *
 * If every level below the best cost is exhausted, nothing cheaper exists:
 * the best solution is provably optimal (`exhausted`).
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
    if (cost < this.bestCost) this.bestCost = cost
  }

  private readonly views: View[]
  private readonly roots: Root[]
  private threshold = 0
  private viewIndex = 0
  private active = false
  private depth = 0
  // The depth-first stack: one entry per depth.
  private readonly tw = new Int32Array(STACK)
  private readonly fl = new Int32Array(STACK)
  private readonly sl = new Int32Array(STACK)
  private readonly spent = new Int32Array(STACK)
  private readonly last = new Int32Array(STACK)
  private readonly next = new Int32Array(STACK)
  private readonly fresh = new Uint8Array(STACK)
  private readonly taken = new Int32Array(STACK) // the move made from each depth
  private tail: number[] = [] // phase-2 moves under construction

  /** `bound`: only solutions costing strictly less than this are wanted. */
  constructor(views: View[], bound = Infinity) {
    initTwoPhase()
    this.views = views
    this.bestCost = bound
    this.roots = views.map((v) => ({
      tw: twistOf(v.start.co),
      fl: flipOf(v.start.eo),
      sl: slicePositionOf(v.start.ep),
    }))
  }

  /** Advance for about `budgetMs`. Returns true once the search is finished. */
  run(budgetMs: number): boolean {
    const t = tables!
    const deadline = performance.now() + budgetMs
    let nodes = 0
    for (;;) {
      if (this.exhausted) return true
      if (!this.active) {
        if (this.threshold >= this.bestCost || this.threshold > MAX_THRESHOLD) {
          this.exhausted = true
          return true
        }
        this.begin()
      }
      while (this.depth >= 0) {
        if ((++nodes & 1023) === 0 && performance.now() > deadline) return false
        const d = this.depth
        if (this.fresh[d]) {
          this.fresh[d] = 0
          const spent = this.spent[d]
          const g1 = Math.max(
            t.prune1Twist[this.sl[d] * N_TWIST + this.tw[d]],
            t.prune1Flip[this.sl[d] * N_FLIP + this.fl[d]],
            t.prune1TwistFlip[this.tw[d] * N_FLIP + this.fl[d]],
          )
          if (spent + g1 > this.threshold) {
            this.depth--
            continue
          }
          if (g1 === 0 && spent === this.threshold) {
            // Ending on a phase-2 move would just be a cheaper phase 1 plus that move.
            if (this.last[d] < 0 || !isPhase2Move(this.last[d])) this.leaf(d)
            this.depth--
            continue
          }
          this.next[d] = 0
        }
        const row = (this.last[d] + 1) * N_MOVES
        let m = this.next[d]
        while (m < N_MOVES && !ALLOWED[row + m]) m++
        if (m >= N_MOVES) {
          this.depth--
          continue
        }
        this.next[d] = m + 1
        const c = d + 1
        this.taken[d] = m
        this.tw[c] = t.twistMove[this.tw[d] * N_MOVES + m]
        this.fl[c] = t.flipMove[this.fl[d] * N_MOVES + m]
        this.sl[c] = t.sliceMove[this.sl[d] * N_MOVES + m]
        this.spent[c] = this.spent[d] + quarterCost(m)
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
    this.tail = []
    if (this.bestCost === Infinity) {
      // No solution yet: any one will do, so deepen phase 2 until one appears.
      for (let limit = floor; !this.phase2First(head, cp, ue, sp, 0, limit, last, base); limit++);
    } else {
      this.phase2Better(head, cp, ue, sp, 0, last, base)
    }
  }

  private record(head: number[], cost: number): void {
    const real = this.views[this.viewIndex].toReal([...head, ...this.tail])
    this.best = real
    this.bestCost = cost
    this.onImprove?.(real, cost)
  }

  // Phase 2 for the first solution: iterative deepening, since there is no bound yet.
  private phase2First(head: number[], cp: number, ue: number, sp: number, spent: number, limit: number, last: number, base: number): boolean {
    const t = tables!
    const h = Math.max(t.prune2Corner[sp * N_PERM8 + cp], t.prune2Edge[sp * N_PERM8 + ue])
    if (spent + h > limit) return false
    if (h === 0) {
      this.record(head, base + spent)
      return true
    }
    const row = (last + 1) * N_MOVES
    for (const m of PHASE2_MOVES) {
      if (!ALLOWED[row + m]) continue
      this.tail.push(m)
      const found = this.phase2First(
        head,
        t.cpermMove[cp * N_MOVES + m],
        t.uedgeMove[ue * N_MOVES + m],
        t.spermMove[sp * N_MOVES + m],
        spent + quarterCost(m),
        limit,
        m,
        base,
      )
      this.tail.pop()
      if (found) return true
    }
    return false
  }

  // Phase 2 once a solution exists: one pass bounded by the best total so far,
  // which tightens each time something better is recorded.
  private phase2Better(head: number[], cp: number, ue: number, sp: number, spent: number, last: number, base: number): void {
    const t = tables!
    const h = Math.max(t.prune2Corner[sp * N_PERM8 + cp], t.prune2Edge[sp * N_PERM8 + ue])
    if (base + spent + h >= this.bestCost) return
    if (h === 0) {
      this.record(head, base + spent)
      return
    }
    const row = (last + 1) * N_MOVES
    for (const m of PHASE2_MOVES) {
      if (!ALLOWED[row + m]) continue
      this.tail.push(m)
      this.phase2Better(head, t.cpermMove[cp * N_MOVES + m], t.uedgeMove[ue * N_MOVES + m], t.spermMove[sp * N_MOVES + m], spent + quarterCost(m), m, base)
      this.tail.pop()
    }
  }
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

/**
 * IDA* over the whole cube, trying costs from `from` up to (not including)
 * `below`. Every lower bound it uses is exact for part of the cube, so it never
 * over-estimates and the first solution found is the cheapest one there is.
 */
function proveOptimal(start: Cubie, below: number, from: number, timeMs: number): ProofResult {
  initProofTables()
  const t = tables!
  const p = proofTables!
  const deadline = performance.now() + timeMs
  let nodes = 0
  let timeUp = false
  const path: number[] = []

  const bound = (tw: number, fl: number, sl: number, cp: number, ea: number, eb: number, s4: number) =>
    Math.max(
      t.prune1Twist[sl * N_TWIST + tw],
      t.prune1Flip[sl * N_FLIP + fl],
      t.prune1TwistFlip[tw * N_FLIP + fl],
      p.pruneCorners[cp],
      p.pruneEdges6[ea * N_EDGE3 + eb],
      p.pruneSlice[s4],
    )

  let threshold = 0
  // When every bound is 0 the cube is solved: twist, flip, all corner places,
  // and ten edge places are right, which leaves the last two edges no choice
  // (swapping only them would break the parity that the corners pin down).
  function dfs(tw: number, fl: number, sl: number, cp: number, ea: number, eb: number, s4: number, spent: number, last: number): boolean {
    if ((++nodes & 2047) === 0 && performance.now() > deadline) timeUp = true
    if (timeUp) return false
    const h = bound(tw, fl, sl, cp, ea, eb, s4)
    if (spent + h > threshold) return false
    if (h === 0) return true
    const row = (last + 1) * N_MOVES
    for (let m = 0; m < N_MOVES; m++) {
      if (!ALLOWED[row + m]) continue
      path.push(m)
      if (
        dfs(
          t.twistMove[tw * N_MOVES + m],
          t.flipMove[fl * N_MOVES + m],
          t.sliceMove[sl * N_MOVES + m],
          p.cpermMove[cp * N_MOVES + m],
          p.edge3Move[ea * N_MOVES + m],
          p.edge3Move[eb * N_MOVES + m],
          p.edge4Move[s4 * N_MOVES + m],
          spent + quarterCost(m),
          m,
        )
      )
        return true
      path.pop()
    }
    return false
  }

  const tw = twistOf(start.co)
  const fl = flipOf(start.eo)
  const sl = slicePositionOf(start.ep)
  const cp = permRank(start.cp, 8)
  const ea = edgeSlotsOf(start.ep, EDGES_A)
  const eb = edgeSlotsOf(start.ep, EDGES_B)
  const s4 = edgeSlotsOf(start.ep, SLICE_EDGES)
  const floor = Math.max(from, bound(tw, fl, sl, cp, ea, eb, s4))

  for (threshold = floor; threshold < below; threshold++) {
    path.length = 0
    if (dfs(tw, fl, sl, cp, ea, eb, s4, 0, -1)) return { path: path.slice(), noneBelow: costOf(path) }
    if (timeUp) return { path: null, noneBelow: threshold }
  }
  return { path: null, noneBelow: Math.max(below, floor) }
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
  const start = moves.reduce((s, m) => multiply(s, MOVES[m]), SOLVED)
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
  return done(best, proof.noneBelow)
}

/**
 * A short solution (as face turns) for the cube reached by `scramble`. Returns
 * "" when the cube is already solved. Two-phase only, no proof.
 */
export function solveTwoPhase(scramble: string, options: { timeMs?: number } = {}): string {
  initTwoPhase()
  const moves = movesOf(scramble)
  if (isSolvedCubie(moves.reduce((s, m) => multiply(s, MOVES[m]), SOLVED))) return ''
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

function randomPermutation(n: number): number[] {
  const p = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = randomBelow(i + 1)
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  return p
}

const parityOf = (p: number[]) => {
  let swaps = 0
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[j] < p[i]) swaps++
  return swaps % 2
}

/**
 * A cube state drawn uniformly from all 43,252,003,274,489,856,000 reachable
 * ones: random corner and edge arrangements with matching parity, random
 * twists summing to a multiple of 3, random flips summing to a multiple of 2.
 */
export function randomCubie(): Cubie {
  const cp = randomPermutation(8)
  const ep = randomPermutation(12)
  // Corner and edge parity must agree; swapping the last two edges pairs every
  // odd arrangement with exactly one even one, so the result stays uniform.
  if (parityOf(cp) !== parityOf(ep)) [ep[10], ep[11]] = [ep[11], ep[10]]
  const co = Array.from({ length: 7 }, () => randomBelow(3))
  co.push((3 - (co.reduce((a, b) => a + b, 0) % 3)) % 3)
  const eo = Array.from({ length: 11 }, () => randomBelow(2))
  eo.push(eo.reduce((a, b) => a + b, 0) % 2)
  return { cp, co, ep, eo }
}

/**
 * A random-state scramble: pick a uniformly random cube, solve it, and play
 * the solution backwards. Applying the result to a solved cube makes exactly
 * that random cube. (Same method as official competition scramblers.)
 */
export function randomScramble(): string {
  initTwoPhase()
  for (;;) {
    const target = randomCubie()
    if (isSolvedCubie(target)) continue
    const job = new RefineJob([{ start: target, toReal: (p) => p }])
    runJob(job, 250)
    const solution = job.best!
    // A random cube needs about 20 turns; a much shorter one is a rare easy
    // cube, so draw again rather than hand out an easy scramble.
    if (solution.length < 16) continue
    return invertPath(solution).map(moveName).join(' ')
  }
}
