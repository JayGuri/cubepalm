import { CUBE3_COLORS, FACE_ORDER, facesOfSlot, slotId, type Face } from '../../puzzles/cube3/geometry'
import { faceletColors } from '../../puzzles/cube3/sync'
import type { PuzzleState } from '../../puzzles/PuzzlePlugin'
import { NORMAL, stageDoneOn, type StageGoal } from '../stages'

// The teaching solver's own cube: 54 stickers in an array, turned by
// permutations worked out once from the geometry. It is small and fast enough
// to try a move out before saying it, which is all the teacher needs.
//
// A sticker's colour is stored as the face whose centre has that colour, so
// "solved" means every sticker names its own face, whichever way the centres
// happen to sit. Cube space is the app's: x right, y up, z towards you.

export type Slot = [number, number, number]
/** Sticker index -> the index in FACE_ORDER of the face whose centre has that colour. */
export type Cube = Uint8Array

const FACE_INDEX = Object.fromEntries(FACE_ORDER.map((f, i) => [f, i])) as Record<Face, number>

const dot = (a: Slot, b: Slot) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const same = (a: Slot, b: Slot) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
export const sameSlot = same

/** A quarter turn clockwise about the outward normal `n`, as seen looking at that face. */
function quarter(n: Slot, v: Slot): Slot {
  const d = dot(n, v)
  const c: Slot = [n[1] * v[2] - n[2] * v[1], n[2] * v[0] - n[0] * v[2], n[0] * v[1] - n[1] * v[0]]
  return [n[0] * d - c[0] + 0, n[1] * d - c[1] + 0, n[2] * d - c[2] + 0]
}

const faceOf = (n: Slot) => FACE_ORDER.find((f) => same(NORMAL[f], n))!

/** The slot touching exactly these faces: a centre, an edge or a corner. */
export const slotOf = (...faces: Face[]): Slot =>
  faces.reduce<Slot>((s, f) => [s[0] + NORMAL[f][0], s[1] + NORMAL[f][1], s[2] + NORMAL[f][2]], [0, 0, 0])

const SLOTS: Slot[] = []
for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) SLOTS.push([x, y, z])

const key = (s: Slot) => (s[0] + 1) * 9 + (s[1] + 1) * 3 + (s[2] + 1)
const STICKER = new Int8Array(27 * 6).fill(-1)
const STICKER_SLOT: Slot[] = []
const STICKER_FACE: Face[] = []
for (const s of SLOTS) {
  for (const f of facesOfSlot(s)) {
    STICKER[key(s) * 6 + FACE_INDEX[f]] = STICKER_SLOT.length
    STICKER_SLOT.push(s)
    STICKER_FACE.push(f)
  }
}

/** Index of the sticker on face `f` of the piece at slot `s`. */
export const sticker = (s: Slot, f: Face) => STICKER[key(s) * 6 + FACE_INDEX[f]]
/** The colour (named by its centre's face) on face `f` of the piece at `s`. */
export const colourAt = (cube: Cube, s: Slot, f: Face): Face => FACE_ORDER[cube[sticker(s, f)]]

export const SOLVED: Cube = Uint8Array.from(STICKER_FACE, (f) => FACE_INDEX[f])

// TURNS[face * 3 + q]: where each sticker's colour comes from after the face
// turns q + 1 quarter turns clockwise.
const TURNS: Uint8Array[] = []
for (const f of FACE_ORDER) {
  const n = NORMAL[f]
  const once = Uint8Array.from({ length: 54 }, (_, i) => i)
  STICKER_SLOT.forEach((s, i) => {
    if (dot(s, n) === 1) once[sticker(quarter(n, s), faceOf(quarter(n, NORMAL[STICKER_FACE[i]])))] = i
  })
  let p = once
  for (let q = 0; q < 3; q++) {
    TURNS.push(p)
    const prev = p
    p = Uint8Array.from(once, (o) => prev[o])
  }
}

/** One face turn: "R", "U'" or "F2". */
export function turn(cube: Cube, move: string): Cube {
  const p = TURNS[FACE_INDEX[move[0] as Face] * 3 + (move.length === 1 ? 0 : move[1] === '2' ? 1 : 2)]
  return Uint8Array.from(p, (from) => cube[from])
}

export const play = (cube: Cube, moves: string[]) => moves.reduce(turn, cube)

/** The undo of a sequence: reversed, each turn the other way. */
export const invert = (moves: string[]) =>
  moves.toReversed().map((m) => (m.includes('2') ? m[0] + '2' : m.endsWith("'") ? m[0] : `${m}'`))

/** The four sides, each followed by the one on its right as you look at it. */
export const SIDES: Face[] = ['F', 'R', 'B', 'L']
export const rightOf = (f: Face) => SIDES[(SIDES.indexOf(f) + 1) % 4]
export const leftOf = (f: Face) => SIDES[(SIDES.indexOf(f) + 3) % 4]
export const oppositeOf = (f: Face) => SIDES[(SIDES.indexOf(f) + 2) % 4]

/**
 * An algorithm done with `front` facing you instead of F. Holding the cube
 * that way is a whole-cube turn about the vertical axis, so each side face
 * moves one place round per quarter turn; Up and Down stay put. That way the
 * learner never has to turn the cube: for example the trigger R U R' U' done
 * from the right side is B U B' U'.
 */
export function fromSide(moves: string[], front: Face): string[] {
  const k = SIDES.indexOf(front)
  return moves.map((m) => {
    const i = SIDES.indexOf(m[0] as Face)
    return i < 0 ? m : SIDES[(i + k) % 4] + m.slice(1)
  })
}

/** Turns the top so a piece on side `from` ends up on side `to`. */
export function topTurn(from: Face, to: Face): string[] {
  // U carries the front to the left: one place back round SIDES.
  return [[], ['U'], ['U2'], ["U'"]][(SIDES.indexOf(from) - SIDES.indexOf(to) + 4) % 4]
}

export const quarterTurns = (moves: string[]) => moves.reduce((n, m) => n + (m.includes('2') ? 2 : 1), 0)

const EDGE_SLOTS = SLOTS.filter((s) => facesOfSlot(s).length === 2)
const CORNER_SLOTS = SLOTS.filter((s) => facesOfSlot(s).length === 3)

export interface Found {
  slot: Slot
  /** For each colour of the piece (named by its home face), the face that sticker is on now. */
  on: Partial<Record<Face, Face>>
}

/** Where the piece that belongs at `home` is now, and which way round. */
export function find(cube: Cube, home: Slot): Found {
  const want = facesOfSlot(home)
  for (const slot of want.length === 2 ? EDGE_SLOTS : CORNER_SLOTS) {
    const faces = facesOfSlot(slot)
    const colours = faces.map((f) => colourAt(cube, slot, f))
    if (colours.every((c) => want.includes(c))) {
      const on: Found['on'] = {}
      colours.forEach((c, i) => (on[c] = faces[i]))
      return { slot, on }
    }
  }
  throw new Error('That is not a cube that can be solved.')
}

/** Every sticker of the piece at `home` matches the centre beside it. */
export const inPlace = (cube: Cube, home: Slot) => facesOfSlot(home).every((f) => colourAt(cube, home, f) === f)

export const isSolved = (cube: Cube) => cube.every((c, i) => c === SOLVED[i])

export const cubeStageDone = (goal: StageGoal, cube: Cube) => stageDoneOn(goal, (s, f) => colourAt(cube, s, f))

// --- Colours as the learner sees them ------------------------------------------

/**
 * The Academy shows the cube turned over, white on the bottom: on screen white
 * and yellow trade places, and so do green and blue. Internal sticker colour ->
 * colour shown (the same swap as FreePlay's FLIP_COLORS).
 */
export const ACADEMY_REMAP: Record<string, string> = {
  [CUBE3_COLORS.U]: CUBE3_COLORS.D,
  [CUBE3_COLORS.D]: CUBE3_COLORS.U,
  [CUBE3_COLORS.F]: CUBE3_COLORS.B,
  [CUBE3_COLORS.B]: CUBE3_COLORS.F,
}

const NAME_OF: Record<string, string> = {
  [CUBE3_COLORS.U]: 'white',
  [CUBE3_COLORS.D]: 'yellow',
  [CUBE3_COLORS.F]: 'green',
  [CUBE3_COLORS.B]: 'blue',
  [CUBE3_COLORS.R]: 'red',
  [CUBE3_COLORS.L]: 'orange',
}

/** The name of an internal sticker colour as it shows in the Academy: '#FFD500' (internal yellow) is 'white'. */
export const academyColourName = (hex: string) => NAME_OF[ACADEMY_REMAP[hex] ?? hex]

/** For each face, the name of its centre's colour as the learner sees it. */
export type Names = Record<Face, string>

/** The names for a cube whose centres sit where they start: white bottom, yellow top, blue front. */
export const HOME_NAMES = Object.fromEntries(FACE_ORDER.map((f) => [f, academyColourName(CUBE3_COLORS[f])])) as Names

/** Reads an app cube into the teacher's model, with the colour names the learner sees. */
export function readState(state: PuzzleState): { cube: Cube; names: Names } {
  const colors = faceletColors(state)
  const hexAt = (s: Slot, f: Face) => colors.get(slotId(s))![f]
  const centres = FACE_ORDER.map((f) => hexAt(NORMAL[f], f))
  const cube = Uint8Array.from(STICKER_SLOT, (s, i) => centres.indexOf(hexAt(s, STICKER_FACE[i])))
  const names = Object.fromEntries(FACE_ORDER.map((f, i) => [f, academyColourName(centres[i])])) as Names
  return { cube, names }
}
