// Reading a scramble that a person typed or pasted: "R U2 F' L D2".
//
// It accepts the six face turns, each optionally a half turn (2) or reversed
// ('), separated by spaces or commas, which is how scrambles are written
// everywhere. It is forgiving about the characters people really paste (curly
// apostrophes, a prime written before the 2) and strict about everything else,
// naming the first thing it could not read rather than guessing.

export const SCRAMBLE_FACES = ['R', 'U', 'F', 'L', 'D', 'B'] as const
/** Longer than any scramble needs to be, short enough that a paste of the wrong thing is caught. */
export const MAX_SCRAMBLE_TURNS = 100

export interface ParsedScramble {
  /** The turns in order, normalised: "R", "R'" or "R2". */
  turns: string[]
  /** What is wrong, in words a player can act on; null when the scramble is fine. */
  error: string | null
}

const TURN = /^([RUFLDB])(2'|'2|2|')?$/

export function parseScramble(text: string): ParsedScramble {
  const tokens = text
    .replace(/[‘’ʹ′`]/g, "'")
    .split(/[\s,]+/)
    .filter(Boolean)
  const turns: string[] = []
  for (const token of tokens) {
    const match = TURN.exec(token)
    if (!match) {
      const lower = /^[rufldb]/.test(token)
      return {
        turns,
        error: lower
          ? `"${token}" is not a turn. Face letters are capitals: ${token[0].toUpperCase()}${token.slice(1)}.`
          : `"${token}" is not a turn. Use R U F L D B, with ' for the other way and 2 for a half turn.`,
      }
    }
    // "R2'" and "R'2" are the same half turn as "R2".
    turns.push(match[1] + (match[2]?.includes('2') ? '2' : (match[2] ?? '')))
  }
  if (turns.length > MAX_SCRAMBLE_TURNS) {
    return { turns: turns.slice(0, MAX_SCRAMBLE_TURNS), error: `That is ${turns.length} turns; the most a scramble can have here is ${MAX_SCRAMBLE_TURNS}.` }
  }
  return { turns, error: null }
}
