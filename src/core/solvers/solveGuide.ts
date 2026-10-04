import type { Move } from '../puzzles/PuzzlePlugin'

// Turns a Kociemba solution into steps a person can follow one at a time.
//
// Every step is a single quarter turn, because that is what one hand sign (or
// one key press, or one drag) makes: a double turn "R2" becomes two "R" steps.
// The guide never assumes the user followed it -- each move they actually
// make either matches the next step (advance) or doesn't (re-solve from the
// new position, so the remaining guidance is always the shortest from where
// the cube really is, not from where it should have been).

export interface GuideState {
  steps: string[]
  index: number
}

export function expandSteps(moves: Move[]): string[] {
  const steps: string[] = []
  for (const m of moves) {
    const s = m.alg.toString()
    // "2'" is a valid way to write a double turn (inverting "U2" produces
    // it) -- it is the same 180 degrees, so it splits the same way.
    const match = /^([RLUDFBMES])(2'?|'|)$/.exec(s)
    if (!match) throw new Error(`Unexpected move in solution: ${s}`)
    const [, face, suffix] = match
    if (suffix.startsWith('2')) steps.push(face, face)
    else steps.push(`${face}${suffix}`)
  }
  return steps
}

export function createGuide(moves: Move[]): GuideState {
  return { steps: expandSteps(moves), index: 0 }
}

export type GuideOutcome = 'advanced' | 'finished' | 'off-track'

export function followMove(guide: GuideState, notation: string): { guide: GuideState; outcome: GuideOutcome } {
  if (guide.steps[guide.index] !== notation) return { guide, outcome: 'off-track' }
  const next = { ...guide, index: guide.index + 1 }
  return { guide: next, outcome: next.index >= next.steps.length ? 'finished' : 'advanced' }
}

const FACE_NAME: Record<string, string> = {
  R: 'Right face',
  L: 'Left face',
  U: 'Top face',
  D: 'Bottom face',
  F: 'Front face',
  B: 'Back face',
  M: 'Middle slice (between Left and Right, turns like Left)',
  E: 'Equator slice (between Top and Bottom, turns like Bottom)',
  S: 'Standing slice (between Front and Back, turns like Front)',
}

/** "Turn the Right face clockwise" -- clockwise as if looking straight at that face. */
export function describeStep(notation: string): string {
  const face = notation[0]
  const prime = notation.endsWith("'")
  return `Turn the ${FACE_NAME[face] ?? face} ${prime ? 'counter-clockwise' : 'clockwise'}`
}

/** "R" <-> "R'" (quarter turns only, as the guide shows them). */
export const invertStep = (step: string) => (step.endsWith("'") ? step.slice(0, -1) : `${step}'`)
