// Cube notation in plain words, for anyone who has never seen "R U R' U'".
// A letter names a layer; ' turns it back the other way; 2 turns it twice.

export const LAYER_NAME: Record<string, string> = {
  R: 'Right',
  L: 'Left',
  U: 'Up',
  D: 'Down',
  F: 'Front',
  B: 'Back',
  M: 'Middle',
  E: 'Equator',
  S: 'Standing',
}

export type TurnKind = 'clockwise' | 'counter' | 'double'

/** Splits "R2'" into its layer letter and how it turns. */
export function parseTurn(move: string): { layer: string; kind: TurnKind } {
  const kind: TurnKind = move.includes('2') ? 'double' : move.endsWith("'") ? 'counter' : 'clockwise'
  return { layer: move[0], kind }
}

/** "R" is "Right", "U'" is "Up back", "F2" is "Front twice". */
export function moveWords(move: string): string {
  const { layer, kind } = parseTurn(move)
  const name = LAYER_NAME[layer] ?? layer
  if (kind === 'double') return `${name} twice`
  if (kind === 'counter') return name === 'Back' ? 'Back, reversed' : `${name} back`
  return name
}

/** The moves of a sequence, split out of its text: "R U' F2" gives ["R", "U'", "F2"]. */
export function splitMoves(sequence: string): string[] {
  return sequence.match(/[URFDLBMES]2?'?/g) ?? []
}

/** A whole sequence in words: "Right, Up back, Front twice". */
export function sequenceWords(sequence: string): string {
  return splitMoves(sequence).map(moveWords).join(', ')
}
