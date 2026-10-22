// The exact cost of phase 1, for every cube, in 35 MB.
//
// Phase 1 of the two-phase search must bring a cube into G1 (no twisted
// corner, no flipped edge, the four middle-layer edges in the middle layer).
// Whether a cube is there, and how far it is, depends on three coordinates:
// corner twist (2187 values), edge flip (2048) and slice position (495), so
// 2,217,093,120 combinations. The small tables in twoPhase.ts each look at two
// of the three and take the largest answer, which is safe but often low: the
// search then walks into thousands of dead ends for every phase-1 solution it
// finds (measured: one solution per 2,000 to 4,800 nodes).
//
// This table holds the EXACT cost of phase 1 for all 2.2 billion combinations,
// made small in two ways (Kociemba's own method, here in quarter turns):
//
//  1. Symmetry. Turning the cube about its U-D axis, turning it upside down, or
//     looking at it in a mirror (16 symmetries in all) leaves the goal G1 where
//     it is and maps moves to moves of the same cost, so a cube and its 16
//     images are equally far from G1. Flip and slice together (1,013,760
//     values) fall into 64,430 families of images; only one member of each
//     family, the representative, is stored, with every twist: 64,430 x 2187 =
//     140,908,410 entries. To look a cube up, find the symmetry s that carries
//     its flip-slice to the representative's, and carry its twist by the same s.
//
//  2. Two bits per entry. A quarter turn changes the cost by at most one, so a
//     neighbour's cost is the current cost minus one, the same, or plus one:
//     three cases that the cost mod 3 tells apart. The table stores cost mod 3;
//     the search knows the exact cost at the root (walk down to G1 once) and
//     updates it one quarter turn at a time.
//
// The proofs that this stays exact and admissible are in docs/MATH.md, section 8.

import {
  conjugate,
  flipOf,
  flipToEo,
  MOVES,
  multiply,
  N_FLIP,
  N_MOVES,
  N_SLICE,
  N_SYM_UD,
  N_TWIST,
  QUARTER_MOVES,
  SLICE_GOAL,
  slicePositionOf,
  sliceToEp,
  SOLVED,
  SYM_INV,
  SYMS,
  twistOf,
  twistToCo,
  type Cubie,
} from './cubie'

export const N_FLIPSLICE = N_SLICE * N_FLIP
export const N_FLIPSLICE_CLASS = 64430
export const N_PHASE1 = N_FLIPSLICE_CLASS * N_TWIST
const UNSET = 3

// ---- Phase-1 move tables (small, shared with twoPhase.ts) ---------------------
export interface Phase1Moves {
  twistMove: Uint16Array
  flipMove: Uint16Array
  sliceMove: Uint16Array
}
let moves: Phase1Moves | null = null

export function phase1Moves(): Phase1Moves {
  if (moves) return moves
  const twistMove = new Uint16Array(N_TWIST * N_MOVES)
  const flipMove = new Uint16Array(N_FLIP * N_MOVES)
  const sliceMove = new Uint16Array(N_SLICE * N_MOVES)
  for (let t = 0; t < N_TWIST; t++) {
    const c: Cubie = { ...SOLVED, co: twistToCo(t) }
    for (let m = 0; m < N_MOVES; m++) twistMove[t * N_MOVES + m] = twistOf(multiply(c, MOVES[m]).co)
  }
  for (let f = 0; f < N_FLIP; f++) {
    const c: Cubie = { ...SOLVED, eo: flipToEo(f) }
    for (let m = 0; m < N_MOVES; m++) flipMove[f * N_MOVES + m] = flipOf(multiply(c, MOVES[m]).eo)
  }
  for (let r = 0; r < N_SLICE; r++) {
    const c: Cubie = { ...SOLVED, ep: sliceToEp(r) }
    for (let m = 0; m < N_MOVES; m++) sliceMove[r * N_MOVES + m] = slicePositionOf(multiply(c, MOVES[m]).ep)
  }
  moves = { twistMove, flipMove, sliceMove }
  return moves
}

// ---- The table ------------------------------------------------------------------
export interface Phase1Table {
  /** Family of each flip-slice value (slice * 2048 + flip). */
  fsClass: Uint16Array
  /** The symmetry s with s x s^-1 = the family's representative. */
  fsSym: Uint8Array
  /** Representative flip-slice value of each family. */
  fsRep: Uint32Array
  /** Bit s set when symmetry s maps the representative to itself. */
  fsStab: Uint16Array
  /** twistConj[t * 16 + s]: the twist of s x s^-1 for a cube x with twist t. */
  twistConj: Uint16Array
  /** Phase-1 cost mod 3, two bits per entry, at family * 2187 + carried twist. */
  cost3: Uint32Array
}

let table: Phase1Table | null = null
let builder: Generator<void, Phase1Table> | null = null
let buildMs = 0

export const isPhase1TableReady = () => table !== null
export const getPhase1Table = () => table
/** Milliseconds of work the build took (time between slices not counted). */
export const phase1TableBuildMs = () => buildMs

/**
 * Builds the table for about `budgetMs`, then returns; call again to continue.
 * True once it is complete. Lets a worker build it in slices and still answer
 * messages in between.
 */
export function buildPhase1TableStep(budgetMs: number): boolean {
  if (table) return true
  builder ??= build()
  const started = performance.now()
  const deadline = started + budgetMs
  try {
    for (;;) {
      const r = builder.next()
      if (r.done) {
        table = r.value
        builder = null
        return true
      }
      if (performance.now() >= deadline) return false
    }
  } finally {
    buildMs += performance.now() - started
  }
}

/** Builds the whole table now (about 6 s on a desktop). */
export function initPhase1Table(): Phase1Table {
  while (!buildPhase1TableStep(1000));
  return table!
}

/** Two-bit entry i of a packed table. */
export const read3 = (cost3: Uint32Array, i: number) => (cost3[i >>> 4] >>> ((i & 15) << 1)) & 3

/** Index of a phase-1 position in the table. */
export function phase1Index(t: Phase1Table, twist: number, flip: number, slice: number): number {
  const fs = slice * N_FLIP + flip
  return t.fsClass[fs] * N_TWIST + t.twistConj[twist * N_SYM_UD + t.fsSym[fs]]
}

/**
 * The exact phase-1 cost (quarter turns to reach G1). The table gives it mod 3;
 * from any position off G1 some quarter turn lowers the cost by one, and that
 * neighbour is the one whose entry is one less mod 3, so walking down those
 * neighbours to G1 counts the cost.
 */
export function phase1Cost(t: Phase1Table, twist: number, flip: number, slice: number): number {
  const { twistMove, flipMove, sliceMove } = phase1Moves()
  let cost = 0
  let here = read3(t.cost3, phase1Index(t, twist, flip, slice))
  while (twist !== 0 || flip !== 0 || slice !== SLICE_GOAL) {
    const down = (here + 2) % 3
    let moved = false
    for (const m of QUARTER_MOVES) {
      const tw = twistMove[twist * N_MOVES + m]
      const fl = flipMove[flip * N_MOVES + m]
      const sl = sliceMove[slice * N_MOVES + m]
      if (read3(t.cost3, phase1Index(t, tw, fl, sl)) === down) {
        twist = tw
        flip = fl
        slice = sl
        here = down
        cost++
        moved = true
        break
      }
    }
    if (!moved) throw new Error('phase-1 table is inconsistent')
  }
  return cost
}

/**
 * The cost after one more quarter turn, from the cost before it and the
 * table's entry (mod 3) after it: the two differ by at most one.
 */
export const stepCost = (before: number, after3: number) => {
  const d = (after3 - before + 3) % 3 // 0: same, 1: one more, 2: one less
  return d === 0 ? before : d === 1 ? before + 1 : before - 1
}

// ---- Building ---------------------------------------------------------------------
// The work is split into small pieces with `yield` between them, so
// buildPhase1TableStep can stop at any piece and carry on later.
function* build(): Generator<void, Phase1Table> {
  const { twistMove, flipMove, sliceMove } = phase1Moves()

  // 1. Twist under the 16 symmetries. They twist every corner the same way (or
  //    mirror every corner), so the new twist depends on the old twist alone.
  const twistConj = new Uint16Array(N_TWIST * N_SYM_UD)
  for (let t = 0; t < N_TWIST; t++) {
    const c: Cubie = { ...SOLVED, co: twistToCo(t) }
    for (let s = 0; s < N_SYM_UD; s++) twistConj[t * N_SYM_UD + s] = twistOf(conjugate(c, s).co)
  }
  yield

  // 2. Families of flip-slice values. Edges only, on preallocated arrays: this
  //    loop runs a million times.
  const fsClass = new Uint16Array(N_FLIPSLICE).fill(0xffff)
  const fsSym = new Uint8Array(N_FLIPSLICE)
  const reps: number[] = []
  const symEp = SYMS.slice(0, N_SYM_UD).map((s) => s.ep)
  const symEo = SYMS.slice(0, N_SYM_UD).map((s) => s.eo)
  const ep = new Int8Array(12)
  const eo = new Int8Array(12)
  const tmpEp = new Int8Array(12)
  const tmpEo = new Int8Array(12)
  const outEp = new Int8Array(12)
  const outEo = new Int8Array(12)
  // flip-slice value of s^-1 x s for the cube held in ep/eo.
  const conjFs = (s: number) => {
    const si = SYM_INV[s]
    const aEp = symEp[si]
    const aEo = symEo[si]
    for (let e = 0; e < 12; e++) {
      tmpEp[e] = aEp[ep[e]]
      tmpEo[e] = (aEo[ep[e]] + eo[e]) & 1
    }
    const bEp = symEp[s]
    const bEo = symEo[s]
    for (let e = 0; e < 12; e++) {
      outEp[e] = tmpEp[bEp[e]]
      outEo[e] = (tmpEo[bEp[e]] + bEo[e]) & 1
    }
    let flip = 0
    for (let e = 0; e < 11; e++) flip = flip * 2 + outEo[e]
    let slice = 0
    let k = 1
    for (let slot = 0; slot < 12; slot++) if (outEp[slot] >= 8) slice += CHOOSE[slot * 5 + k++]
    return slice * N_FLIP + flip
  }
  for (let slc = 0; slc < N_SLICE; slc++) {
    const sliceEp = sliceToEp(slc)
    for (let flip = 0; flip < N_FLIP; flip++) {
      const idx = slc * N_FLIP + flip
      if (fsClass[idx] !== 0xffff) continue
      const cls = reps.length
      reps.push(idx)
      fsClass[idx] = cls
      fsSym[idx] = 0
      const flipEo = flipToEo(flip)
      for (let e = 0; e < 12; e++) {
        ep[e] = sliceEp[e]
        eo[e] = flipEo[e]
      }
      for (let s = 1; s < N_SYM_UD; s++) {
        const j = conjFs(s) // s^-1 x s, so s carries it back to the representative
        if (fsClass[j] === 0xffff) {
          fsClass[j] = cls
          fsSym[j] = s
        }
      }
    }
    if (slc % 25 === 24) yield
  }
  if (reps.length !== N_FLIPSLICE_CLASS) throw new Error(`expected ${N_FLIPSLICE_CLASS} flip-slice families, found ${reps.length}`)
  const fsRep = Uint32Array.from(reps)
  const fsStab = new Uint16Array(N_FLIPSLICE_CLASS)
  for (let cls = 0; cls < N_FLIPSLICE_CLASS; cls++) {
    const sliceEp = sliceToEp((fsRep[cls] / N_FLIP) | 0)
    const flipEo = flipToEo(fsRep[cls] % N_FLIP)
    for (let e = 0; e < 12; e++) {
      ep[e] = sliceEp[e]
      eo[e] = flipEo[e]
    }
    for (let s = 0; s < N_SYM_UD; s++) if (conjFs(SYM_INV[s]) === fsRep[cls]) fsStab[cls] |= 1 << s
  }
  yield

  // 3. Twist after each quarter turn, already carried by each symmetry.
  const nQ = QUARTER_MOVES.length
  const turnConj = new Uint16Array(nQ * N_SYM_UD * N_TWIST)
  for (let q = 0; q < nQ; q++) {
    for (let s = 0; s < N_SYM_UD; s++) {
      for (let t = 0; t < N_TWIST; t++) turnConj[(q * N_SYM_UD + s) * N_TWIST + t] = twistConj[twistMove[t * N_MOVES + QUARTER_MOVES[q]] * N_SYM_UD + s]
    }
  }

  // 4. Breadth-first search by quarter turns, outward from G1. Early levels
  //    are small: expand each entry of the current level ("forward"). Late
  //    levels are most of the table: for each entry still unknown, look for a
  //    neighbour on the current level ("backward"). Both give exact costs.
  const cost3 = new Uint32Array(Math.ceil(N_PHASE1 / 16)).fill(0xffffffff)
  const get = (i: number) => (cost3[i >>> 4] >>> ((i & 15) << 1)) & 3
  const put = (i: number, v: number) => {
    const w = i >>> 4
    const sh = (i & 15) << 1
    cost3[w] = (cost3[w] & ~(3 << sh)) | (v << sh)
  }
  let done = 0
  // Forward search marks one representation of a position; a family that maps
  // to itself under some symmetries has other entries for images of the same
  // position, equally far from G1, which must be marked at the same time.
  const mark = (cls: number, t: number, v: number) => {
    const i = cls * N_TWIST + t
    if (get(i) !== UNSET) return
    put(i, v)
    done++
    const stab = fsStab[cls]
    if (stab === 1) return
    for (let s = 1; s < N_SYM_UD; s++) {
      if (((stab >> s) & 1) === 0) continue
      const i2 = cls * N_TWIST + twistConj[t * N_SYM_UD + s]
      if (get(i2) === UNSET) {
        put(i2, v)
        done++
      }
    }
  }
  const goal = SLICE_GOAL * N_FLIP
  mark(fsClass[goal], twistConj[fsSym[goal]], 0)
  const nextClass = new Int32Array(nQ)
  const nextTwist = new Int32Array(nQ)
  // Measured: switching at level 10 builds fastest (8.1 s at 9, 5.2 s at 10).
  const BACKWARD_FROM = 10
  for (let depth = 0; done < N_PHASE1; depth++) {
    if (depth > 30) throw new Error('phase-1 table did not fill')
    const here = depth % 3
    const next = (depth + 1) % 3
    const backward = depth >= BACKWARD_FROM
    for (let cls = 0; cls < N_FLIPSLICE_CLASS; cls++) {
      const rep = fsRep[cls]
      const flip = rep % N_FLIP
      const slc = (rep / N_FLIP) | 0
      for (let q = 0; q < nQ; q++) {
        const m = QUARTER_MOVES[q]
        const fs = sliceMove[slc * N_MOVES + m] * N_FLIP + flipMove[flip * N_MOVES + m]
        nextClass[q] = fsClass[fs]
        nextTwist[q] = (q * N_SYM_UD + fsSym[fs]) * N_TWIST
      }
      const base = cls * N_TWIST
      if (!backward) {
        for (let t = 0; t < N_TWIST; t++) {
          const i = base + t
          // Skip 16 unknown entries at once while the table is still empty.
          if ((i & 15) === 0 && cost3[i >>> 4] === 0xffffffff && t + 16 <= N_TWIST) {
            t += 15
            continue
          }
          // (An entry at depth - 3 also reads `here`; its neighbours are all known, so it changes nothing.)
          if (get(i) !== here) continue
          for (let q = 0; q < nQ; q++) mark(nextClass[q], turnConj[nextTwist[q] + t], next)
        }
      } else {
        for (let t = 0; t < N_TWIST; t++) {
          const i = base + t
          if (get(i) !== UNSET) continue
          for (let q = 0; q < nQ; q++) {
            if (get(nextClass[q] * N_TWIST + turnConj[nextTwist[q] + t]) === here) {
              put(i, next)
              done++
              break
            }
          }
        }
      }
      if ((cls & 511) === 511) yield
    }
  }
  return { fsClass, fsSym, fsRep, fsStab, twistConj, cost3 }
}

// choose(n, k) for n < 12, k <= 4, as a flat table for the hot loop above.
const CHOOSE = new Int32Array(12 * 5)
for (let n = 0; n < 12; n++) {
  for (let k = 0; k <= 4; k++) {
    let r = k <= n ? 1 : 0
    for (let i = 1; i <= k && k <= n; i++) r = (r * (n - k + i)) / i
    CHOOSE[n * 5 + k] = r
  }
}
