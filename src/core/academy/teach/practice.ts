import { facesOfSlot } from '../../puzzles/cube3/geometry'
import { lessonById } from '../lessons'
import { NORMAL, type StageGoal } from '../stages'
import { cubeStageDone, HOME_NAMES, invert, rightOf, sameSlot, SIDES, slotOf, SOLVED, sticker, type Cube, type Slot } from './cube'
import { teachCube } from './teach'

// Practice positions: a random cube with every stage before the lesson's done
// and the lesson's own not done, uniform over all such cubes.
//
// It is built piece by piece, the way a random-state scrambler works: the
// pieces the earlier stages fix stay home, the rest are shuffled among their
// slots and turned at random, keeping the three rules every real cube obeys
// (corner and edge arrangements of the same parity, total corner twist a
// multiple of 3, total edge flip even). A cube whose lesson stage happens to be
// done already is drawn again, which keeps the rest equally likely. The setup
// moves are the teaching solver's own route for that cube, played backwards.

/** A uniformly random integer in [0, n), from the cryptographic generator. */
function randomBelow(n: number): number {
  const buffer = new Uint32Array(1)
  const limit = Math.floor(2 ** 32 / n) * n // drop the uneven tail so every value is equally likely
  do crypto.getRandomValues(buffer)
  while (buffer[0] >= limit)
  return buffer[0] % n
}

const det = (a: Slot, b: Slot, c: Slot) =>
  a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])

/**
 * A slot's faces in the order its piece's turn is counted: top or bottom face
 * first (front or back for a middle edge), a corner's faces clockwise. With
 * this order, a real cube's twists add up to a multiple of 3 and its flips to
 * an even number.
 */
function turnOrder(slot: Slot) {
  const f = facesOfSlot(slot)
  return f.length === 3 && det(NORMAL[f[0]], NORMAL[f[1]], NORMAL[f[2]]) !== -1 ? [f[0], f[2], f[1]] : f
}

const parity = (p: number[]) => {
  let odd = 0
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[j] < p[i]) odd ^= 1
  return odd
}

function shuffle(n: number, below: (n: number) => number): number[] {
  const p = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = below(i + 1)
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  return p
}

/**
 * A cube drawn uniformly from those with every piece outside `free` at home:
 * the pieces whose homes are in `free` are shuffled among those slots, and the
 * ones that land in a `turn` slot are twisted or flipped at random. `free` must
 * hold at least two edges.
 */
export function randomCube(free: Slot[], turn: Slot[], below: (n: number) => number): Cube {
  const cube = SOLVED.slice()
  const turned = (s: Slot) => turn.some((t) => sameSlot(t, s))
  let cornerParity = 0
  for (const n of [3, 2]) {
    const slots = free.filter((s) => facesOfSlot(s).length === n)
    const order = shuffle(slots.length, below)
    // Pair every edge arrangement of the wrong parity with exactly one of the right parity.
    if (n === 3) cornerParity = parity(order)
    else if (parity(order) !== cornerParity) [order[0], order[1]] = [order[1], order[0]]
    const last = slots.filter(turned).at(-1)
    let total = 0
    slots.forEach((slot, i) => {
      const home = turnOrder(slots[order[i]])
      const twist = !turned(slot) ? 0 : slot === last ? (n - (total % n)) % n : below(n)
      total += twist
      const to = turnOrder(slot)
      for (let j = 0; j < n; j++) cube[sticker(slot, to[(j + twist) % n])] = SOLVED[sticker(slots[order[i]], home[j])]
    })
  }
  return cube
}

const ring = (f: (v: (typeof SIDES)[number]) => Slot) => SIDES.map(f)
const BOTTOM_EDGES = ring((v) => slotOf('D', v))
const BOTTOM_CORNERS = ring((v) => slotOf('D', v, rightOf(v)))
const MIDDLE_EDGES = ring((v) => slotOf(v, rightOf(v)))
const TOP_EDGES = ring((v) => slotOf('U', v))
const TOP_CORNERS = ring((v) => slotOf('U', v, rightOf(v)))
const TOP = [...TOP_EDGES, ...TOP_CORNERS]

/** For each lesson goal: the pieces still free once every earlier stage is done, and which of them may be turned. */
const FREEDOM: Record<StageGoal, [free: Slot[], turn: Slot[]]> = {
  cross: [[...BOTTOM_EDGES, ...BOTTOM_CORNERS, ...MIDDLE_EDGES, ...TOP], [...BOTTOM_EDGES, ...BOTTOM_CORNERS, ...MIDDLE_EDGES, ...TOP]],
  firstLayer: [[...BOTTOM_CORNERS, ...MIDDLE_EDGES, ...TOP], [...BOTTOM_CORNERS, ...MIDDLE_EDGES, ...TOP]],
  secondLayer: [[...MIDDLE_EDGES, ...TOP], [...MIDDLE_EDGES, ...TOP]],
  topCross: [TOP, TOP],
  topFace: [TOP, TOP_CORNERS],
  topCorners: [TOP, []],
  solved: [TOP_EDGES, []],
}

/**
 * Setup moves, from a solved cube, for a random practice position of a lesson:
 * every stage before the lesson's is done and the lesson's own is not, each
 * such cube equally likely. The moves can be long; apply them without animating.
 * Meet the cube has no goal and practises on a solved cube, where each turn's
 * effect is easiest to see, so it gives "".
 *
 * `below(n)` must return a uniformly random integer in [0, n); it defaults to
 * the cryptographic generator, and tests pass a seeded one.
 */
export function practicePosition(lessonId: string, below: (n: number) => number = randomBelow): string {
  const lesson = lessonById(lessonId)
  if (!lesson) throw new Error(`There is no lesson called "${lessonId}".`)
  if (!lesson.goal) return ''
  const [free, turn] = FREEDOM[lesson.goal]
  for (;;) {
    const cube = randomCube(free, turn, below)
    if (!cubeStageDone(lesson.goal, cube)) return invert(teachCube(cube, HOME_NAMES).flatMap((s) => s.moves)).join(' ')
  }
}
