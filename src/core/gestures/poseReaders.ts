import { distance, handScale } from './landmarkMath'
import type { Landmark } from './landmarks'

// Reading a pose: which of the four fingers are raised. Everything else in sign
// recognition (the vote over frames, the hold, the turn) is built on this one
// answer, so there are several ways to get it here, all with the same shape, to
// be compared on the same data (research/sign-recognition.study.ts).
//
// A pose is four characters, index finger first: '1' raised, '0' folded.

export type PoseReader = (landmarks: Landmark[]) => string

const WRIST = 0
/** Knuckle, middle joint, end joint, tip, for index, middle, ring, pinky. */
const JOINTS: Array<[number, number, number, number]> = [
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
]

/**
 * MediaPipe reports x as a fraction of the picture's width and y as a fraction
 * of its height, so on a 4:3 picture a hand held sideways measures a third
 * longer than the same hand held upright. This puts x (and depth, which uses
 * x's scale) back into the same units as y.
 */
export function squarePixels(landmarks: Landmark[], aspect: number): Landmark[] {
  return landmarks.map((p) => ({ x: p.x * aspect, y: p.y, z: p.z * aspect }))
}

/** Drops depth, for readers that should not lean on MediaPipe's least reliable coordinate. */
export function flatten(landmarks: Landmark[]): Landmark[] {
  return landmarks.map((p) => ({ x: p.x, y: p.y, z: 0 }))
}

/**
 * The rule the app has used from the start: a finger is raised when its tip is
 * far from the wrist, measured in hand sizes. One threshold for every finger.
 */
export function distanceReader(extendedRatio = 1.4): PoseReader {
  return (landmarks) => {
    const wrist = landmarks[WRIST]
    const scale = handScale(landmarks)
    return JOINTS.map(([, , , tip]) => (distance(landmarks[tip], wrist) / scale > extendedRatio ? '1' : '0')).join('')
  }
}

const sub = (a: Landmark, b: Landmark): Landmark => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const dot = (a: Landmark, b: Landmark) => a.x * b.x + a.y * b.y + a.z * b.z
const cosine = (a: Landmark, b: Landmark) => {
  const lengths = Math.sqrt(dot(a, a) * dot(b, b))
  return lengths > 1e-12 ? dot(a, b) / lengths : 0
}

/**
 * What a finger looks like, in numbers that do not change when the hand is
 * nearer, farther, turned or longer-fingered:
 *
 *   reach      tip-to-knuckle distance over the finger's own length along its
 *              bones. 1 when the finger is straight, small when it is folded.
 *   align      how far the finger points the way the palm does: the cosine of
 *              the angle between wrist-to-knuckle and knuckle-to-tip.
 *   middleBend the cosine of the bend at the middle joint (-1 is straight).
 *   endBend    the same at the end joint.
 *   tipRatio   the old rule's number: tip-to-wrist distance in hand sizes.
 */
export interface FingerFeatures {
  reach: number
  align: number
  middleBend: number
  endBend: number
  tipRatio: number
}

export function fingerFeatures(landmarks: Landmark[], finger: number): FingerFeatures {
  const [k, m, e, t] = JOINTS[finger].map((i) => landmarks[i])
  const wrist = landmarks[WRIST]
  const bones = distance(k, m) + distance(m, e) + distance(e, t)
  return {
    reach: bones > 1e-12 ? distance(k, t) / bones : 0,
    align: cosine(sub(k, wrist), sub(t, k)),
    middleBend: cosine(sub(k, m), sub(e, m)),
    endBend: cosine(sub(m, e), sub(t, e)),
    tipRatio: distance(t, wrist) / handScale(landmarks),
  }
}

export interface AngleThresholds {
  /** A finger must be at least this straight to count as raised. */
  reach: number
  /** ...and point at least this much the way the palm does. */
  align: number
}

/** Chosen on generated training data by research/trainReader.ts; see docs/research/sign-recognition.md. */
export const DEFAULT_ANGLE_THRESHOLDS: AngleThresholds = { reach: 0.8, align: 0.5 }

/**
 * A finger is raised when it is straight and points the way the palm does.
 * Both tests are about the finger's own shape, so neither the hand's size nor
 * its distance from the wrist enters, and each finger is judged against its own
 * length rather than one threshold for all four.
 */
export function angleReader(thresholds: AngleThresholds = DEFAULT_ANGLE_THRESHOLDS): PoseReader {
  return (landmarks) =>
    JOINTS.map((_, finger) => {
      const f = fingerFeatures(landmarks, finger)
      return f.reach > thresholds.reach && f.align > thresholds.align ? '1' : '0'
    }).join('')
}

export interface MarginThresholds {
  /** At least this straight, and... */
  raisedReach: number
  /** ...pointing at least this much with the palm, to count as raised. */
  raisedAlign: number
  /** No straighter than this to count as folded. Anything between the two is neither. */
  foldedReach: number
}

/**
 * The angle reader with a dead zone. A finger is raised only when it is clearly
 * straight, folded only when it is clearly bent, and otherwise '?': the hand is
 * then making no pose at all. A relaxed hand, whose fingers hover half curled,
 * falls in the dead zone instead of being read as whichever sign it happens to
 * be nearest, which is what stops an idle hand from turning the cube.
 */
export function marginReader(thresholds: MarginThresholds): PoseReader {
  return (landmarks) =>
    JOINTS.map((_, finger) => {
      const f = fingerFeatures(landmarks, finger)
      if (f.reach > thresholds.raisedReach && f.align > thresholds.raisedAlign) return '1'
      if (f.reach < thresholds.foldedReach) return '0'
      return '?'
    }).join('')
}

/** Weights of the learned reader: one logistic unit over the finger's features, plus an offset per finger. */
export interface LearnedWeights {
  /** In the order reach, align, middleBend, endBend, tipRatio. */
  features: [number, number, number, number, number]
  /** One per finger: index, middle, ring, pinky. */
  bias: [number, number, number, number]
}

export const featureVector = (f: FingerFeatures): number[] => [f.reach, f.align, f.middleBend, f.endBend, f.tipRatio]

/** The learned reader's belief, 0 to 1, that a finger is raised. */
export function raisedProbability(weights: LearnedWeights, landmarks: Landmark[], finger: number): number {
  const x = featureVector(fingerFeatures(landmarks, finger))
  const z = x.reduce((sum, value, i) => sum + value * weights.features[i], weights.bias[finger])
  return 1 / (1 + Math.exp(-z))
}

/**
 * Logistic regression over the same features the angle reader uses, with the
 * weights found from examples instead of chosen by hand. It can weigh the
 * features against each other, which two fixed thresholds cannot.
 */
export function learnedReader(weights: LearnedWeights): PoseReader {
  return (landmarks) => JOINTS.map((_, finger) => (raisedProbability(weights, landmarks, finger) > 0.5 ? '1' : '0')).join('')
}
