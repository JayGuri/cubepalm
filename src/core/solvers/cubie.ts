// The cube as numbers: pieces, the 18 face turns, the 48 symmetries of the
// cube, and the coordinates the solver searches over. Everything here is plain
// arithmetic on small arrays; the search and its tables live in twoPhase.ts and
// phase1Table.ts. docs/MATH.md, section 8, explains each piece.

/** Moves are numbered face * 3 + (0: clockwise, 1: half turn, 2: counter-clockwise). */
export const FACE_LETTERS = 'URFDLB'
export const N_MOVES = 18

// Corners: URF UFL ULB UBR DFR DLF DBL DRB.  Edges: UR UF UL UB DR DF DL DB FR FL BL BR.
export interface Cubie {
  cp: number[] // which corner sits in each corner slot
  co: number[] // its twist, 0..2 (3..5 only inside a mirror symmetry, see multiply)
  ep: number[] // which edge sits in each edge slot
  eo: number[] // its flip, 0..1
}

const [URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB] = [0, 1, 2, 3, 4, 5, 6, 7]
const [UR, UF, UL, UB, DR, DF, DL, DB, FR, FL, BL, BR] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
export const zeros = (n: number) => new Array<number>(n).fill(0)

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

export const SOLVED: Cubie = {
  cp: [0, 1, 2, 3, 4, 5, 6, 7],
  co: zeros(8),
  ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  eo: zeros(12),
}

/**
 * `a` then `b`. A corner twist of 3..5 marks a corner seen in a mirror (only
 * the mirror symmetries below have them): a mirror reverses the sense of a
 * twist, so twists subtract where one side is mirrored. For two ordinary cubes
 * this is the usual rule, twists adding mod 3.
 */
export function multiply(a: Cubie, b: Cubie): Cubie {
  const cp: number[] = []
  const co: number[] = []
  const ep: number[] = []
  const eo: number[] = []
  for (let c = 0; c < 8; c++) {
    cp[c] = a.cp[b.cp[c]]
    const oa = a.co[b.cp[c]]
    const ob = b.co[c]
    if (oa < 3 && ob < 3) co[c] = (oa + ob) % 3
    else if (oa < 3) co[c] = 3 + ((oa + ob) % 3) // b mirrored: so is the result
    else if (ob < 3) co[c] = 3 + ((oa - ob + 3) % 3) // a mirrored: so is the result
    else co[c] = (oa - ob + 3) % 3 // both mirrored: an ordinary cube again
  }
  for (let e = 0; e < 12; e++) {
    ep[e] = a.ep[b.ep[e]]
    eo[e] = (a.eo[b.ep[e]] + b.eo[e]) % 2
  }
  return { cp, co, ep, eo }
}

// All 18 moves: each face turned once, twice and three times.
export const MOVES: Cubie[] = []
for (let f = 0; f < 6; f++) {
  let m = BASIC_MOVES[f]
  for (let p = 0; p < 3; p++) {
    MOVES.push(m)
    m = multiply(m, BASIC_MOVES[f])
  }
}
export const ALL_MOVES = Array.from({ length: N_MOVES }, (_, i) => i)
/** The 12 quarter turns. A half turn is two of them, which is why it costs 2. */
export const QUARTER_MOVES = ALL_MOVES.filter((m) => m % 3 !== 1)

/** Phase 2 may only use U D (any turn) and half turns of R L F B. */
export const PHASE2_MOVES = [0, 1, 2, 9, 10, 11, 4, 7, 13, 16]
export const isPhase2Move = (m: number) => {
  const face = (m / 3) | 0
  return face === 0 || face === 3 || m % 3 === 1
}

export const quarterCost = (m: number) => (m % 3 === 1 ? 2 : 1)

// A move may not repeat the last face, and of two opposite faces only the
// U-before-D order is allowed (R L and L R reach the same place). Indexed by
// (last move + 1) * 18 + move, so "no last move" is row 0.
export const ALLOWED = new Uint8Array(19 * N_MOVES)
for (let last = -1; last < N_MOVES; last++) {
  for (let m = 0; m < N_MOVES; m++) {
    const f = (m / 3) | 0
    const lf = last < 0 ? -9 : (last / 3) | 0
    ALLOWED[(last + 1) * N_MOVES + m] = f !== lf && f + 3 !== lf ? 1 : 0
  }
}

export const sameCubie = (a: Cubie, b: Cubie) =>
  a.cp.every((v, i) => v === b.cp[i]) && a.co.every((v, i) => v === b.co[i]) && a.ep.every((v, i) => v === b.ep[i]) && a.eo.every((v, i) => v === b.eo[i])
export const isSolvedCubie = (c: Cubie) => sameCubie(c, SOLVED)
export const applyMoves = (start: Cubie, moves: number[]) => moves.reduce((s, m) => multiply(s, MOVES[m]), start)

// ---- Symmetries ---------------------------------------------------------------
// A symmetry is a way of picking the cube up (a rotation) or of looking at it in
// a mirror, written as a cubie like a move. Conjugating by it, s x s^-1, gives
// the same position seen from the other side: as far from solved as x, because
// s m s^-1 is again a move of the same cost for every move m (tested).
//
// All 48 are products of four basic ones (Kociemba's numbering):
//   s = urf3 * 16 + f2 * 8 + u4 * 2 + lr2
// where urf3 turns the cube 120 degrees about the URF-DBL corner axis, f2 turns
// it 180 degrees about the F axis, u4 90 degrees about the U axis, and lr2
// reflects it left to right. The first 16 (urf3 = 0) keep the U-D axis where it
// is; those are the ones that preserve phase 1's goal.
const ROT_URF3: Cubie = { cp: [URF, DFR, DLF, UFL, UBR, DRB, DBL, ULB], co: [1, 2, 1, 2, 2, 1, 2, 1], ep: [UF, FR, DF, FL, UB, BR, DB, BL, UR, DR, DL, UL], eo: [1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1] }
const ROT_F2: Cubie = { cp: [DLF, DFR, DRB, DBL, UFL, URF, UBR, ULB], co: zeros(8), ep: [DL, DF, DR, DB, UL, UF, UR, UB, FL, FR, BR, BL], eo: zeros(12) }
const ROT_U4: Cubie = { cp: [UBR, URF, UFL, ULB, DRB, DFR, DLF, DBL], co: zeros(8), ep: [UB, UR, UF, UL, DB, DR, DF, DL, BR, FR, FL, BL], eo: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1] }
const MIRR_LR2: Cubie = { cp: [UFL, URF, UBR, ULB, DLF, DFR, DRB, DBL], co: [3, 3, 3, 3, 3, 3, 3, 3], ep: [UL, UF, UR, UB, DL, DF, DR, DB, FL, FR, BR, BL], eo: zeros(12) }

export const N_SYM = 48
/** Symmetries that keep the U-D axis: the 16 used to shrink the phase-1 table. */
export const N_SYM_UD = 16
export const SYMS: Cubie[] = []
{
  let c = SOLVED
  for (let urf3 = 0; urf3 < 3; urf3++) {
    for (let f2 = 0; f2 < 2; f2++) {
      for (let u4 = 0; u4 < 4; u4++) {
        for (let lr2 = 0; lr2 < 2; lr2++) {
          SYMS.push(c)
          c = multiply(c, MIRR_LR2)
        }
        c = multiply(c, ROT_U4)
      }
      c = multiply(c, ROT_F2)
    }
    c = multiply(c, ROT_URF3)
  }
}
/** SYM_INV[s] is the symmetry that undoes s. */
export const SYM_INV = SYMS.map((s) => SYMS.findIndex((t) => sameCubie(multiply(s, t), SOLVED)))
/** s x s^-1: the cube x seen through symmetry s. */
export const conjugate = (x: Cubie, s: number) => multiply(multiply(SYMS[s], x), SYMS[SYM_INV[s]])
/** CONJ_MOVE[m * 48 + s] is the move s m s^-1. */
export const CONJ_MOVE = new Int8Array(N_MOVES * N_SYM)
for (let m = 0; m < N_MOVES; m++) {
  for (let s = 0; s < N_SYM; s++) CONJ_MOVE[m * N_SYM + s] = MOVES.findIndex((x) => sameCubie(x, conjugate(MOVES[m], s)))
}
/** The symmetry that shows the R-L axis as U-D (axis 1) and the F-B axis as U-D (axis 2). */
export const AXIS_SYM = [0, 16, 32]

// ---- Coordinates ---------------------------------------------------------
export const N_TWIST = 2187
export const N_FLIP = 2048
export const N_SLICE = 495
export const N_PERM8 = 40320
export const N_PERM4 = 24
export const N_EDGE3 = 12 ** 3 // slots of three named edges, written in base 12
export const N_EDGE4 = 12 ** 4 // slots of four named edges
/** The slice coordinate of the solved cube (the four middle-layer edges in slots 8..11). */
export const SLICE_GOAL = 494

export const FACTORIAL = [1, 1, 2, 6, 24, 120, 720, 5040, 40320]
export const choose = (n: number, k: number) => {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return r
}

export const twistOf = (co: number[]) => co.slice(0, 7).reduce((t, v) => t * 3 + v, 0)
export const flipOf = (eo: number[]) => eo.slice(0, 11).reduce((t, v) => t * 2 + v, 0)

export function twistToCo(t: number): number[] {
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

export function flipToEo(t: number): number[] {
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
export function slicePositionOf(ep: number[]): number {
  let rank = 0
  let k = 1
  for (let slot = 0; slot < 12; slot++) {
    if (ep[slot] >= 8) rank += choose(slot, k++)
  }
  return rank
}

/** An edge arrangement with this slice position: slice slots hold 8..11 in order, the others 0..7 in order. */
export function sliceToEp(rank: number): number[] {
  const inSlice = zeros(12)
  for (let k = 4; k >= 1; k--) {
    let slot = 11
    while (choose(slot, k) > rank) slot--
    rank -= choose(slot, k)
    inSlice[slot] = 1
  }
  let other = 0
  let slice = 8
  return inSlice.map((s) => (s ? slice++ : other++))
}

/** Position of a permutation among all n! permutations (Lehmer code). */
export function permRank(p: ArrayLike<number>, n: number): number {
  let rank = 0
  for (let i = 0; i < n - 1; i++) {
    let smaller = 0
    for (let j = i + 1; j < n; j++) if (p[j] < p[i]) smaller++
    rank += smaller * FACTORIAL[n - 1 - i]
  }
  return rank
}

export function permUnrank(rank: number, n: number): number[] {
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

/** 0 for an even arrangement, 1 for an odd one. */
export function parityOf(p: ArrayLike<number>): number {
  let swaps = 0
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[j] < p[i]) swaps++
  return swaps % 2
}

// Where an edge in slot s goes after move m. (A move sends the piece in slot
// MOVES[m].ep[e] to slot e.)
export const SLOT_AFTER: number[][] = MOVES.map((mv) => {
  const out = zeros(12)
  for (let e = 0; e < 12; e++) out[mv.ep[e]] = e
  return out
})

/** The slots holding the given edges, as one base-12 number (first edge in the lowest digit). */
export function edgeSlotsOf(ep: number[], ids: number[]): number {
  let code = 0
  let place = 1
  for (const id of ids) {
    code += ep.indexOf(id) * place
    place *= 12
  }
  return code
}

// Edge groups the solver follows by their slots.
export const U_EDGES = [UR, UF, UL, UB]
export const D_EDGES = [DR, DF, DL, DB]
export const SLICE_EDGES = [FR, FL, BL, BR]
export const EDGES_A = [UR, UF, UL]
export const EDGES_B = [UB, DR, DF]
