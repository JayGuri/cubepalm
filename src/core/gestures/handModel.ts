import type { HandFrame, Handedness, Landmark } from './landmarks'

// A hand you can pose. It produces the same 21 landmarks MediaPipe does, from
// a description of the hand (how long its fingers are), its pose (how far each
// finger is curled) and how the camera sees it (size, tilt, noise).
//
// It exists so the sign recogniser can be measured: with a real camera nobody
// knows the true pose, but here it is an input, so "how often is the pose read
// correctly when the hand is tilted 30 degrees?" has an answer. It is a model,
// not a hand: what it shows is how sensitive a recogniser is to each thing that
// varies, not how well it does on people. Recordings of real hands answer that
// (see research/recordings).
//
// Units: the distance from the wrist to the middle knuckle is 1.

export type Finger = 'index' | 'middle' | 'ring' | 'pinky'
export const FINGERS: Finger[] = ['index', 'middle', 'ring', 'pinky']

/** MediaPipe's landmark numbers for each finger: knuckle, middle joint, end joint, tip. */
export const FINGER_JOINTS: Record<Finger, [number, number, number, number]> = {
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
}

interface FingerShape {
  /** Where the knuckle sits on the palm (x across the hand, y toward the fingers). */
  knuckle: [number, number]
  /** How far the finger leans sideways from straight up, in degrees. */
  splay: number
  /** Lengths of its three bones, knuckle to tip. */
  bones: [number, number, number]
}

// Rough proportions of an adult hand, chosen by eye and not taken from a
// measured source: the middle finger about 0.84 of the palm's length, the
// little finger about 0.63. They do not need to be exact, because the study
// varies finger length on purpose (`fingerLength`). What matters is the shape
// of the problem: the little finger is much the shortest, so a rule with one
// threshold for every finger leaves it the least margin.
const SHAPE: Record<Finger, FingerShape> = {
  index: { knuckle: [0.28, 0.95], splay: 8, bones: [0.36, 0.22, 0.18] },
  middle: { knuckle: [0.05, 1.0], splay: 0, bones: [0.4, 0.25, 0.19] },
  ring: { knuckle: [-0.17, 0.93], splay: -8, bones: [0.37, 0.24, 0.19] },
  pinky: { knuckle: [-0.36, 0.8], splay: -18, bones: [0.29, 0.17, 0.17] },
}

// The thumb plays no part in any sign (it is the least reliably tracked
// finger), so it is given one natural resting position.
const THUMB: Array<[number, number, number]> = [
  [0.3, 0.22, -0.05],
  [0.55, 0.45, -0.1],
  [0.7, 0.66, -0.12],
  [0.8, 0.84, -0.12],
]

// How far each joint bends when a finger is fully curled, in degrees: knuckle,
// middle joint, end joint. Roughly a finger making a fist.
const FULL_CURL = [80, 100, 70]

export interface HandPose {
  /** How far each finger is curled: 0 is straight, 1 is a fist. Index, middle, ring, pinky. */
  curl: [number, number, number, number]
  handedness?: Handedness
  /** Turn in the image plane, degrees (a hand held sideways is 90). */
  roll?: number
  /** Fingertips tipped toward (positive) or away from the camera, degrees. */
  pitch?: number
  /** The hand turned about its own long axis, degrees (edge-on is 90). */
  yaw?: number
  /** Wrist-to-middle-knuckle length as a fraction of the picture's height. */
  size?: number
  /** Where the wrist is in the picture, 0..1 each way. */
  at?: [number, number]
  /** Every finger this many times its usual length (0.85 short, 1.15 long). */
  fingerLength?: number
  /** Width over height of the camera picture. Landmarks come out as fractions of each, so 4:3 stretches them. */
  aspect?: number
  /** Jitter on every landmark, as a fraction of the hand's size; depth gets three times as much. */
  noise?: number
  /** Where the jitter comes from: a source of standard-normal numbers. Required when noise is not 0. */
  gaussian?: () => number
  score?: number
}

type V3 = [number, number, number]
const rad = (deg: number) => (deg * Math.PI) / 180

function rotate(v: V3, roll: number, pitch: number, yaw: number): V3 {
  let [x, y, z] = v
  // Yaw: about the hand's long (y) axis.
  ;[x, z] = [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)]
  // Pitch: about the across-the-hand (x) axis. Positive brings the fingertips toward the camera (-z).
  ;[y, z] = [y * Math.cos(pitch) + z * Math.sin(pitch), -y * Math.sin(pitch) + z * Math.cos(pitch)]
  // Roll: in the picture plane.
  ;[x, y] = [x * Math.cos(roll) - y * Math.sin(roll), x * Math.sin(roll) + y * Math.cos(roll)]
  return [x, y, z]
}

/** The four joints of one finger in the hand's own frame (palm facing the camera, fingers up). */
function fingerJoints(shape: FingerShape, curl: number, lengthScale: number): V3[] {
  const splay = rad(shape.splay)
  // Straight, the finger points this way across the palm; curling swings it toward the camera (-z).
  const along: V3 = [Math.sin(splay), Math.cos(splay), 0]
  const joints: V3[] = [[shape.knuckle[0], shape.knuckle[1], 0]]
  let bend = 0
  for (let i = 0; i < 3; i++) {
    bend += rad(FULL_CURL[i] * curl)
    const length = shape.bones[i] * lengthScale
    const from = joints[i]
    joints.push([
      from[0] + along[0] * Math.cos(bend) * length,
      from[1] + along[1] * Math.cos(bend) * length,
      from[2] - Math.sin(bend) * length,
    ])
  }
  return joints
}

/** A hand as the camera would report it. */
export function makeModelHand(pose: HandPose): HandFrame {
  const {
    curl,
    handedness = 'Right',
    roll = 0,
    pitch = 0,
    yaw = 0,
    size = 0.22,
    at = [0.5, 0.75],
    fingerLength = 1,
    aspect = 4 / 3,
    noise = 0,
    gaussian,
    score = 0.95,
  } = pose
  if (noise > 0 && !gaussian) throw new Error('makeModelHand: noise needs a gaussian source')

  const points: V3[] = Array.from({ length: 21 }, () => [0, 0, 0] as V3)
  THUMB.forEach((p, i) => (points[i + 1] = [...p]))
  FINGERS.forEach((finger, f) => {
    const joints = fingerJoints(SHAPE[finger], curl[f], fingerLength)
    FINGER_JOINTS[finger].forEach((index, j) => (points[index] = joints[j]))
  })

  // A left hand is the mirror image of a right one.
  const mirror = handedness === 'Left' ? -1 : 1
  const landmarks: Landmark[] = points.map(([x, y, z]) => {
    const [rx, ry, rz] = rotate([x * mirror, y, z], rad(roll), rad(pitch), rad(yaw))
    const jitter = (scale: number) => (noise > 0 ? gaussian!() * noise * scale : 0)
    // The picture's y runs downward, and x and depth are fractions of its width.
    return {
      x: at[0] + (size * (rx + jitter(1))) / aspect,
      y: at[1] - size * (ry + jitter(1)),
      z: (size * (rz + jitter(3))) / aspect,
    }
  })
  return { landmarks, handedness, score }
}

/** The curl that makes a pose written as four digits, index first: '1' raised, '0' folded. */
export function curlForPose(pose: string, raised = 0, folded = 1): [number, number, number, number] {
  return [...pose].map((digit) => (digit === '1' ? raised : folded)) as [number, number, number, number]
}
