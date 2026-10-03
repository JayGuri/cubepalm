import { parseCubeMove } from '../../animation/parseCubeMove'

export type Vec3 = [number, number, number]
// Integer rotation matrix, as rows.
export type Mat3 = [Vec3, Vec3, Vec3]

// A physical Mirror Cube piece: where it lives when solved, and how far it has
// been turned since. Current slot = rotation · home.
export interface TrackedPiece {
  home: Vec3
  rotation: Mat3
}

/** The tracked blocks inside a Mirror Cube state. */
export function mirrorPiecesOf(state: { raw: unknown }): TrackedPiece[] {
  return (state.raw as { pieces: TrackedPiece[] }).pieces
}

const AXIS_INDEX = { x: 0, y: 1, z: 2 } as const
const IDENTITY: Mat3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
]

export function createPieces(): TrackedPiece[] {
  const pieces: TrackedPiece[] = []
  for (const x of [-1, 0, 1])
    for (const y of [-1, 0, 1])
      for (const z of [-1, 0, 1])
        if (x || y || z) pieces.push({ home: [x, y, z], rotation: IDENTITY })
  return pieces
}

export function mulVec(m: Mat3, v: Vec3): Vec3 {
  return m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]) as Vec3
}

export function currentSlot(p: TrackedPiece): Vec3 {
  return mulVec(p.rotation, p.home)
}

function mulMat(a: Mat3, b: Mat3): Mat3 {
  return a.map((row) =>
    // `+ 0` turns -0 into 0, so equal rotations always compare equal.
    [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j] + 0),
  ) as Mat3
}

// Exact right-handed rotation about the given axis (multiples of 90 degrees).
function axisRotation(axis: 0 | 1 | 2, angle: number): Mat3 {
  const c = Math.round(Math.cos(angle)) + 0 // +0 turns -0 into 0
  const s = Math.round(Math.sin(angle)) + 0
  if (axis === 0) return [[1, 0, 0], [0, c, -s], [0, s, c]]
  if (axis === 1) return [[c, 0, s], [0, 1, 0], [-s, 0, c]]
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]]
}

/**
 * The Mirror Cube is solved when its blocks make a clean cube again. That is a
 * statement about shape: every block has been carried by one and the same
 * whole-cube rotation, so each sits where it started relative to the others
 * (the cube may simply be held another way up). Centres are 1x1 squares, so a
 * centre spun in place looks no different and only its slot is checked.
 */
export function piecesSolved(pieces: TrackedPiece[]): boolean {
  const whole = pieces.find((p) => p.home.every((v) => v !== 0))!.rotation // any corner fixes the rotation
  return pieces.every((p) => {
    const isCentre = p.home.filter((v) => v !== 0).length === 1
    if (isCentre) return currentSlot(p).every((v, i) => v === mulVec(whole, p.home)[i])
    return p.rotation.every((row, i) => row.every((v, j) => v === whole[i][j]))
  })
}

// Pure: returns new pieces. Direction comes from parseCubeMove, which is
// verified against the real cube engine.
export function applyMoveToPieces(pieces: TrackedPiece[], notation: string): TrackedPiece[] {
  const turn = parseCubeMove(notation)
  if (!turn) throw new Error(`unsupported mirror move: ${notation}`)
  const axis = AXIS_INDEX[turn.axis]
  const r = axisRotation(axis, turn.angle)
  return pieces.map((p) =>
    currentSlot(p)[axis] === turn.layer ? { home: p.home, rotation: mulMat(r, p.rotation) } : p,
  )
}
