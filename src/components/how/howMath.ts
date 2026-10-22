import { useEffect, useRef, useState } from 'react'
import { applyMoveToPieces, createPieces, currentSlot, type TrackedPiece, type Vec3 } from '../../core/puzzles/mirror/pieces'
import { splitMoves } from '../../core/notation'
import { makeModelHand } from '../../core/gestures/handModel'
import type { Handedness } from '../../core/gestures/landmarks'
import { createSignState, DEFAULT_SIGN_OPTIONS, readSign, stepSigns, type SignLayer } from '../../core/gestures/signGestures'

// The sums behind the How it works page. Everything shown there is either
// computed here from the app's own modules or quoted from docs/research.

// ---- Counting positions -------------------------------------------------------

/** The factors of the number of positions, each tied to something on the cube. */
export const COUNT_FACTORS = [
  { id: 'corners', label: '8!', value: 40320n, says: 'ways to place the 8 corners' },
  { id: 'twists', label: '3⁷', value: 2187n, says: 'ways to twist 7 corners; the eighth twist is forced' },
  { id: 'edges', label: '12!', value: 479001600n, says: 'ways to place the 12 edges' },
  { id: 'flips', label: '2¹¹', value: 2048n, says: 'ways to flip 11 edges; the twelfth flip is forced' },
  { id: 'parity', label: '÷ 2', value: 2n, says: 'corner and edge swaps always come in step, so half of those are impossible' },
] as const

export type FactorId = (typeof COUNT_FACTORS)[number]['id']

export function positionCount(): bigint {
  const [c, t, e, f, p] = COUNT_FACTORS.map((x) => x.value)
  return (c * t * e * f) / p
}

/** 43252003274489856000 as 43,252,003,274,489,856,000. */
export const groupDigits = (n: bigint) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

// ---- Pieces and slots ----------------------------------------------------------

const isIdentity = (p: TrackedPiece) => p.rotation.every((row, i) => row.every((v, j) => v === (i === j ? 1 : 0)))
const kind = (home: Vec3) => (['centre', 'centre', 'edge', 'corner'] as const)[home.filter((v) => v !== 0).length]

/** A slot's name from its faces, as cubers write it: (1, 1, 1) is UFR. */
export function slotName([x, y, z]: Vec3): string {
  return [y > 0 ? 'U' : y < 0 ? 'D' : '', z > 0 ? 'F' : z < 0 ? 'B' : '', x > 0 ? 'R' : x < 0 ? 'L' : ''].join('')
}

const play = (pieces: TrackedPiece[], moves: string) => splitMoves(moves).reduce(applyMoveToPieces, pieces)

/** The cycles one sequence makes, as lists of slot names: the piece in each slot goes to the next. */
export function cyclesOf(moves: string): { corners: string[][]; edges: string[][] } {
  const after = play(createPieces(), moves)
  const goesTo = new Map<string, string>()
  for (const p of after) {
    if (kind(p.home) === 'centre') continue
    const from = slotName(p.home)
    const to = slotName(currentSlot(p))
    if (from !== to) goesTo.set(from, to)
  }
  const seen = new Set<string>()
  const out = { corners: [] as string[][], edges: [] as string[][] }
  for (const start of goesTo.keys()) {
    if (seen.has(start)) continue
    const cycle: string[] = []
    for (let at = start; !seen.has(at); at = goesTo.get(at)!) {
      seen.add(at)
      cycle.push(at)
    }
    ;(start.length === 3 ? out.corners : out.edges).push(cycle)
  }
  return out
}

export interface RepeatRow {
  /** Corners and edges not in their own slot. */
  moved: number
  /** Corners and edges in their own slot but twisted or flipped. */
  turned: number
}

/** After each repeat of `moves`, how far the cube is from solved; stops at the first solved cube or `max`. */
export function repeatsUntilSolved(moves: string, max = 12): RepeatRow[] {
  const rows: RepeatRow[] = []
  let pieces = createPieces()
  for (let n = 0; n < max; n++) {
    pieces = play(pieces, moves)
    const off = pieces.filter((p) => kind(p.home) !== 'centre' && !isIdentity(p))
    const moved = off.filter((p) => slotName(currentSlot(p)) !== slotName(p.home)).length
    rows.push({ moved, turned: off.length - moved })
    if (off.length === 0) break
  }
  return rows
}

// ---- The two phases of a route --------------------------------------------------

/**
 * The search looks at the cube from six points of view (twoPhase.ts, viewsOf):
 * views 0 to 2 are the cube relabelled 0, 1 or 2 times by a turn about the URF
 * corner, 3 to 5 the same for the inverse cube. In view t the subgroup G1 keeps
 * quarter turns of one pair of faces: U/D for t = 0, F/B for t = 1, R/L for t = 2.
 */
export const G1_FACES = ['UD', 'FB', 'RL'] as const
export const viewOf = (view: number) => ({ faces: G1_FACES[view % 3], inverse: view >= 3 })

/**
 * Which phase found each move of a route from one view. Phase 2 uses only
 * G1's moves and phase 1 never ends on one (twoPhase.ts, RefineJob.run), so
 * phase 2 is exactly the longest run of G1 moves at the end of the route; a
 * route found on the inverse cube is that solution played backwards, so there
 * phase 2 is the longest run at the start.
 */
export function phasesOf(moves: string[], view: number): (1 | 2)[] {
  const { faces, inverse } = viewOf(view)
  const inG1 = (m: string) => m.includes('2') || faces.includes(m[0])
  const order = inverse ? moves : [...moves].reverse()
  let run = 0
  while (run < order.length && inG1(order[run])) run++
  const phases = order.map((_, i) => (i < run ? 2 : 1) as 1 | 2)
  return inverse ? phases : phases.reverse()
}

/** Quarter turns, as the app counts them: a half turn is two. */
export const quarterTurns = (moves: string[]) => moves.reduce((n, m) => n + (m.includes('2') ? 2 : 1), 0)

/**
 * True when every corner and edge keeps the axis of `faces` on that axis: the
 * check that a cube is in that view's G1 (used by the tests to confirm
 * phasesOf splits where phase 1 really ends).
 */
export function inG1(pieces: TrackedPiece[], faces: (typeof G1_FACES)[number]): boolean {
  const axis = { RL: 0, UD: 1, FB: 2 }[faces]
  return pieces.every((p) => kind(p.home) === 'centre' || Math.abs(p.rotation[axis][axis]) === 1)
}
export { play as playOnPieces }

// ---- Statistics -------------------------------------------------------------------

/** Pearson's chi-square statistic against "every outcome equally likely". */
export function chiSquare(counts: number[]): number {
  const total = counts.reduce((a, b) => a + b, 0)
  const expected = total / counts.length
  return expected > 0 ? counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0) : 0
}

/** Milliseconds as people read them: 29 ms, 1.4 s. */
export const ms = (t: number) => (t < 1000 ? `${Math.max(1, Math.round(t))} ms` : `${(t / 1000).toFixed(t < 10_000 ? 1 : 0)} s`)

// ---- Holding a sign ----------------------------------------------------------------

/** A seeded source of numbers in [0, 1), so a run can be shown again exactly. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface HoldFrame {
  t: number
  /** The tracker did not report the hand this frame. */
  lost: boolean
  /** What this frame alone reads as. */
  read: SignLayer | null
  /** What the vote over recent frames recognises. */
  recognised: SignLayer | null
  /** A layer turned on this frame. */
  turn: SignLayer | null
}

export const FRAME_MS = 40 // 25 frames a second, as in docs/research/temporal-filtering.md
export const FORM_MS = 200 // the fingers move from a fist into the sign over this long

/**
 * The shipped recogniser (stepSigns, with its vote, hold and lost-hand grace),
 * run frame by frame on a model hand that closes from a fist into `curl` and
 * holds it, with landmark jitter of 2% of hand size, as the timing study does.
 * `lose` drops each frame with probability 1 in 5.
 */
export function holdRun(curl: number[], handedness: Handedness, { lose, grace, seed }: { lose: boolean; grace: boolean; seed: number }): HoldFrame[] {
  const rand = seeded(seed)
  const gaussian = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
  const opts = { ...DEFAULT_SIGN_OPTIONS, dropGraceMs: grace ? DEFAULT_SIGN_OPTIONS.dropGraceMs : 0 }
  let state = createSignState()
  const frames: HoldFrame[] = []
  for (let t = 0; t <= 2400; t += FRAME_MS) {
    const k = Math.min(1, t / FORM_MS)
    const hand = makeModelHand({ curl: curl.map((c) => 1 + (c - 1) * k) as [number, number, number, number], handedness, noise: 0.02, gaussian })
    const lost = lose && rand() < 0.2
    const { next, events } = stepSigns(state, { hands: lost ? [] : [hand], timestampMs: t }, opts)
    state = next
    frames.push({ t, lost, read: lost ? null : readSign(hand, opts), recognised: state.hands[handedness].current, turn: events[0]?.layer ?? null })
  }
  return frames
}

// ---- On screen --------------------------------------------------------------------

/** The width of an element, kept current: charts draw in real pixels so their text stays readable. */
export function useWidth<T extends Element>(fallback = 560) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** True once the element has come near the screen; it stays true. */
export function useNearScreen<T extends Element>(margin = '200px') {
  const ref = useRef<T>(null)
  // No IntersectionObserver (an old browser, or a test environment without
  // one): treat everything as already near, rather than never starting.
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: margin })
    io.observe(el)
    return () => io.disconnect()
  }, [near, margin])
  return [ref, near] as const
}
