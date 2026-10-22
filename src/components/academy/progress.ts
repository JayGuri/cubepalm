import { LESSONS } from '../../core/academy/lessons'

const ORANGE = '#ff8a00'
// Scrambled, and dimmed: not yet.
const SCRAMBLED = [
  'rgb(244 245 248 / 0.30)',
  'rgb(47 179 107 / 0.40)',
  'rgb(240 86 107 / 0.40)',
  'rgb(255 213 0 / 0.32)',
  'rgb(91 141 239 / 0.42)',
  'rgb(240 86 107 / 0.40)',
  'rgb(244 245 248 / 0.30)',
  'rgb(47 179 107 / 0.40)',
]
/** Where lesson n's sticker sits: round the face clockwise from the top-left. */
export const RING = [0, 1, 2, 5, 8, 7, 6, 3]

export function faceColours(done: string[]): string[] {
  const out: string[] = Array(9).fill(ORANGE)
  LESSONS.forEach((l, i) => (out[RING[i]] = done.includes(l.id) ? ORANGE : SCRAMBLED[i]))
  return out
}

// What the learner saw last, so a lesson finished since turns over on the way
// back to /learn. Kept for the session only, in memory.
let seen: string[] | null = null
export const lastSeen = () => seen
export const markSeen = (done: string[]) => void (seen = done)
/** Called as a lesson opens: remembers progress as it was before the lesson. */
export function rememberProgress(done: string[]) {
  if (seen === null) seen = done
}
