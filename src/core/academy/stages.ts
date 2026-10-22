import { facesOfSlot, slotId, type Face } from '../puzzles/cube3/geometry'
import { faceletColors } from '../puzzles/cube3/sync'
import type { PuzzleState } from '../puzzles/PuzzlePlugin'

// How far through the layer-by-layer method a cube is, read straight off its
// sticker colours. A piece is "in place" when each of its stickers matches the
// centre of the face it sits on -- centres never move on face turns, so they
// are the reference.
//
// The Academy holds the cube with the FIRST layer on the bottom (D) and the
// LAST layer on top (U), like most written tutorials.

type Slot = [number, number, number]

export type StageGoal = 'cross' | 'firstLayer' | 'secondLayer' | 'topCross' | 'topFace' | 'topCorners' | 'solved'

/** Each face's outward direction, which is also the slot of its centre. */
export const NORMAL: Record<Face, Slot> = { U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0] }

const BOTTOM_EDGES: Slot[] = [[0, -1, 1], [1, -1, 0], [0, -1, -1], [-1, -1, 0]]
const BOTTOM_CORNERS: Slot[] = [[1, -1, 1], [-1, -1, 1], [1, -1, -1], [-1, -1, -1]]
const MIDDLE_EDGES: Slot[] = [[1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1]]
const TOP_EDGES: Slot[] = [[0, 1, 1], [1, 1, 0], [0, 1, -1], [-1, 1, 0]]
const TOP_CORNERS: Slot[] = [[1, 1, 1], [-1, 1, 1], [1, 1, -1], [-1, 1, -1]]

/** Stages in order; each one includes everything before it. */
export const STAGE_ORDER: StageGoal[] = ['cross', 'firstLayer', 'secondLayer', 'topCross', 'topFace', 'topCorners', 'solved']

/** What a stage counts: how many of its pieces are right, out of how many. */
interface StageDefinition {
  slots: Slot[]
  /** "inPlace": every sticker right. "topUp": only the top sticker is right. */
  test: 'inPlace' | 'topUp'
  unit: string
}

const STAGES: Record<StageGoal, StageDefinition> = {
  cross: { slots: BOTTOM_EDGES, test: 'inPlace', unit: 'white edges in place' },
  firstLayer: { slots: BOTTOM_CORNERS, test: 'inPlace', unit: 'white corners in place' },
  secondLayer: { slots: MIDDLE_EDGES, test: 'inPlace', unit: 'middle edges in place' },
  topCross: { slots: TOP_EDGES, test: 'topUp', unit: 'yellow edges on top' },
  topFace: { slots: [...TOP_EDGES, ...TOP_CORNERS], test: 'topUp', unit: 'yellow pieces on top' },
  topCorners: { slots: TOP_CORNERS, test: 'inPlace', unit: 'corners in place' },
  solved: { slots: TOP_EDGES, test: 'inPlace', unit: 'top edges in place' },
}

/** The colour on one face of the piece at a slot. Any values do, as long as equal colours compare equal. */
export type StickerReader = (slot: Slot, face: Face) => unknown

function inspect(sticker: StickerReader) {
  const centre = (face: Face) => sticker(NORMAL[face], face)
  return {
    inPlace: (slot: Slot) => facesOfSlot(slot).every((f) => sticker(slot, f) === centre(f)),
    topUp: (slot: Slot) => sticker(slot, 'U') === centre('U'),
  }
}

function readerOf(state: PuzzleState): StickerReader {
  const colors = faceletColors(state)
  return (slot, face) => colors.get(slotId(slot))?.[face]
}

export function stageDone(goal: StageGoal, state: PuzzleState): boolean {
  return stageDoneOn(goal, readerOf(state))
}

/** `stageDone` for a cube read some other way, such as the teaching solver's own model. */
export function stageDoneOn(goal: StageGoal, sticker: StickerReader): boolean {
  const check = inspect(sticker)
  return STAGE_ORDER.slice(0, STAGE_ORDER.indexOf(goal) + 1).every((g) => {
    const stage = STAGES[g]
    return stage.slots.every((slot) => check[stage.test](slot))
  })
}

export interface StageProgress {
  done: number
  total: number
  unit: string
}

/** How many of this stage's own pieces are right (earlier stages are not counted). */
export function stageProgress(goal: StageGoal, state: PuzzleState): StageProgress {
  const check = inspect(readerOf(state))
  const stage = STAGES[goal]
  return { done: stage.slots.filter((slot) => check[stage.test](slot)).length, total: stage.slots.length, unit: stage.unit }
}

/** The stage before this one, or null for the first. */
export function stageBefore(goal: StageGoal): StageGoal | null {
  const i = STAGE_ORDER.indexOf(goal)
  return i > 0 ? STAGE_ORDER[i - 1] : null
}
