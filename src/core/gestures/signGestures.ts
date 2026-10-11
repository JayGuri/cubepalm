import { Alg } from 'cubing/alg'
import type { Move } from '../puzzles/PuzzlePlugin'
import { distanceReader, squarePixels, type PoseReader } from './poseReaders'
import type { Handedness, HandFrame, LandmarkFrame } from './landmarks'
import type { Axis } from './MouseDragAdapter'

// "Signs": CubePalm's two-handed control scheme.
//
//   The POSE picks the layer.   The HAND picks the direction.
//   Right hand = clockwise.     Left hand = counter-clockwise (prime).
//
// Both hands share the same nine poses, so every one of the 18 quarter turns
// is a single, still sign -- nothing to aim, nothing to swipe, and no
// dependence on which way the camera happens to be looking. Holding a pose
// steady for a moment turns the layer once; relax the hand to turn again.
//
// Poses are read from the four fingers (the thumb is ignored: it is the least
// reliable finger to track). The mnemonic mirrors the cube:
//   count from the INDEX side for R, U, F   (1, 2, 3 fingers)
//   count from the PINKY side for L, D, B   (1, 2, 3 fingers)
//   slices: M = both ends, E = the middle two, S = all but the ring finger

export type SignLayer = 'R' | 'L' | 'U' | 'D' | 'F' | 'B' | 'M' | 'E' | 'S'

// Fingers in order index, middle, ring, pinky; '1' = extended.
export const POSE_FOR: Record<SignLayer, string> = {
  R: '1000',
  U: '1100',
  F: '1110',
  L: '0001',
  D: '0011',
  B: '0111',
  M: '1001',
  E: '0110',
  S: '1101',
}

const LAYER_FOR_POSE: Record<string, SignLayer> = Object.fromEntries(
  Object.entries(POSE_FOR).map(([layer, pose]) => [pose, layer as SignLayer]),
)

// Which pieces a layer turns, for the on-cube preview.
export const LAYER_SLICE: Record<SignLayer, { axis: Axis; layer: -1 | 0 | 1 }> = {
  R: { axis: 'x', layer: 1 },
  M: { axis: 'x', layer: 0 },
  L: { axis: 'x', layer: -1 },
  U: { axis: 'y', layer: 1 },
  E: { axis: 'y', layer: 0 },
  D: { axis: 'y', layer: -1 },
  F: { axis: 'z', layer: 1 },
  S: { axis: 'z', layer: 0 },
  B: { axis: 'z', layer: -1 },
}


// ---------------------------------------------------------------------------
// Tuning knobs. These are the numbers to adjust if signs feel too eager or too
// sluggish once tried with a real camera -- see also Settings > Gesture
// sensitivity, which scales the shared pinch/fist thresholds.
// ---------------------------------------------------------------------------
export interface SignOptions {
  // A fingertip at least this many hand-sizes from the wrist counts as
  // extended. Lower = fingers count as "up" more easily.
  extendedRatio: number
  // A pose is recognised once it wins this many of the last `voteWindow`
  // frames; one badly tracked frame can never turn anything.
  voteWindow: number
  votesToSelect: number
  // How long a recognised pose must be held still before the layer turns.
  holdMs: number
  // Ignore hands MediaPipe is less sure of than this.
  minScore: number
  // MediaPipe's own Left/Right label is used as-is: tested live by the user,
  // it already names their real hands correctly (an earlier version flipped
  // it, on the theory that unmirrored frames would be labelled backwards, and
  // every sign came out on the wrong hand). Settings > Swap left and right
  // hand flips it for any camera/driver that does label them backwards.
  swapHands: boolean
  // How a hand's pose is read from its landmarks. Left out, it is the
  // distance rule with `extendedRatio`; poseReaders.ts has the alternatives.
  reader?: PoseReader
  // Undo the stretch of a non-square picture before reading the pose (the
  // frame carries the picture's shape). Off by default: the distance rule's
  // threshold was tuned by hand on the stretched numbers.
  squarePixels?: boolean
  // How long the tracker may lose a hand before that counts as the hand going
  // away. Trackers drop the odd frame; treating each as "the sign was let go"
  // restarted the hold, so a held sign turned late, or twice.
  dropGraceMs: number
}

export const DEFAULT_SIGN_OPTIONS: SignOptions = {
  extendedRatio: 1.4,
  voteWindow: 6,
  votesToSelect: 4,
  holdMs: 550,
  minScore: 0.5,
  swapHands: false,
  dropGraceMs: 240,
}

function realHandedness(label: Handedness, swapHands: boolean): Handedness {
  if (!swapHands) return label
  return label === 'Left' ? 'Right' : 'Left'
}

/** The layer a hand's pose names, or null (open hand, fist, or unassigned). */
export function readSign(hand: HandFrame, opts: SignOptions = DEFAULT_SIGN_OPTIONS): SignLayer | null {
  const read = opts.reader ?? distanceReader(opts.extendedRatio)
  return LAYER_FOR_POSE[read(hand.landmarks)] ?? null
}

/** The notation a sign makes with a given hand: right = clockwise, left = prime. */
export function notationFor(layer: SignLayer, hand: Handedness): string {
  return hand === 'Right' ? layer : `${layer}'`
}

/** The sign that makes a quarter turn: which hand, which layer. */
export function signForNotation(notation: string): { hand: Handedness; layer: SignLayer } | null {
  const m = /^([RLUDFBMES])('?)$/.exec(notation)
  if (!m) return null
  return { hand: m[2] ? 'Left' : 'Right', layer: m[1] as SignLayer }
}

interface HandSignState {
  // When this hand was last seen at all (any pose); null if never.
  lastSeenMs: number | null
  votes: Array<SignLayer | null>
  current: SignLayer | null
  heldSinceMs: number | null
  // Once a pose has turned the layer it must be released (any other pose,
  // relaxed hand, or hand out of view) before it can turn again.
  fired: boolean
}

export interface SignState {
  hands: Record<Handedness, HandSignState>
}

const emptyHand = (): HandSignState => ({ lastSeenMs: null, votes: [], current: null, heldSinceMs: null, fired: false })

export function createSignState(): SignState {
  return { hands: { Left: emptyHand(), Right: emptyHand() } }
}

export interface ActiveSign {
  hand: Handedness
  layer: SignLayer
  notation: string
  // 0..1 of the hold before it turns; 1 once it has turned.
  progress: number
  fired: boolean
}

export type SignEvent = { type: 'TURN'; hand: Handedness; layer: SignLayer; move: Move }

/** The signs currently being held, for the HUD and the on-cube preview. */
export function activeSigns(state: SignState, nowMs: number, opts: SignOptions = DEFAULT_SIGN_OPTIONS): ActiveSign[] {
  const out: ActiveSign[] = []
  for (const hand of ['Left', 'Right'] as const) {
    const h = state.hands[hand]
    if (!h.current || h.heldSinceMs === null) continue
    const progress = h.fired ? 1 : Math.min(1, (nowMs - h.heldSinceMs) / opts.holdMs)
    out.push({ hand, layer: h.current, notation: notationFor(h.current, hand), progress, fired: h.fired })
  }
  return out
}

function mostVoted(votes: Array<SignLayer | null>): { layer: SignLayer | null; count: number } {
  const counts = new Map<SignLayer, number>()
  for (const v of votes) if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: SignLayer | null = null
  let count = 0
  for (const [layer, n] of counts) if (n > count) [best, count] = [layer, n]
  return { layer: best, count }
}

function stepHand(
  prev: HandSignState,
  // The pose this hand is showing; null for "no sign"; undefined when the
  // tracker did not report the hand at all this frame.
  seen: SignLayer | null | undefined,
  nowMs: number,
  opts: SignOptions,
): { next: HandSignState; turn: SignLayer | null } {
  if (seen === undefined) {
    // Lost for a moment: change nothing, so the vote and the hold carry on when
    // the hand comes back. No turn is made on a frame with no hand in it.
    if (prev.lastSeenMs !== null && nowMs - prev.lastSeenMs <= opts.dropGraceMs) return { next: prev, turn: null }
  }
  const sign = seen ?? null
  prev = seen === undefined ? prev : { ...prev, lastSeenMs: nowMs }
  const votes = [...prev.votes, sign].slice(-opts.voteWindow)
  const { layer: winner, count } = mostVoted(votes)
  const recognised = winner && count >= opts.votesToSelect ? winner : null

  if (recognised !== prev.current) {
    // A new pose (or none): restart the hold, and re-arm.
    return { next: { lastSeenMs: prev.lastSeenMs, votes, current: recognised, heldSinceMs: recognised ? nowMs : null, fired: false }, turn: null }
  }
  if (!recognised || prev.fired || prev.heldSinceMs === null) return { next: { ...prev, votes }, turn: null }
  // Only turn on a frame where the hand is actually showing the sign right
  // now. Recognition stays "sticky" for a couple of frames to ride out
  // flicker, and without this a sign held almost long enough and then
  // DROPPED could still fire on one of those frames, after the hand was gone.
  if (sign === recognised && nowMs - prev.heldSinceMs >= opts.holdMs) {
    return { next: { ...prev, votes, fired: true }, turn: recognised }
  }
  return { next: { ...prev, votes }, turn: null }
}

export function stepSigns(
  state: SignState,
  frame: LandmarkFrame,
  opts: SignOptions = DEFAULT_SIGN_OPTIONS,
): { next: SignState; events: SignEvent[] } {
  const seen: Partial<Record<Handedness, SignLayer | null>> = {}
  for (const hand of frame.hands) {
    if (hand.score < opts.minScore) continue
    const shaped = opts.squarePixels && frame.aspect ? { ...hand, landmarks: squarePixels(hand.landmarks, frame.aspect) } : hand
    seen[realHandedness(hand.handedness, opts.swapHands)] = readSign(shaped, opts)
  }

  const events: SignEvent[] = []
  const hands = { ...state.hands }
  for (const who of ['Right', 'Left'] as const) {
    const { next, turn } = stepHand(state.hands[who], seen[who], frame.timestampMs, opts)
    hands[who] = next
    if (turn) {
      events.push({ type: 'TURN', hand: who, layer: turn, move: { alg: new Alg(notationFor(turn, who)), snapAngleDeg: 90 } })
    }
  }
  return { next: { hands }, events }
}

/** One colour per hand, used everywhere a hand is mentioned, so people can tell which to use at a glance. */
export const HAND_COLOR: Record<Handedness, string> = { Right: '#FFD500', Left: '#4CC9F0' }
