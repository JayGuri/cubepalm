import { describe, expect, it } from 'vitest'
import { curlForPose, makeModelHand, type HandPose } from './handModel'
import { angleReader, distanceReader, fingerFeatures, flatten, learnedReader, squarePixels, type LearnedWeights } from './poseReaders'
import { DEFAULT_SIGN_OPTIONS, POSE_FOR, readSign } from './signGestures'

const POSES = Object.values(POSE_FOR)
const hand = (pose: string, extra: Partial<HandPose> = {}) => makeModelHand({ curl: curlForPose(pose), ...extra }).landmarks

// A stand-in for trained weights: lean on straightness and direction only.
const HAND_SET: LearnedWeights = { features: [12, 4, 0, 0, 0], bias: [-11, -11, -11, -11] }
const READERS = [distanceReader(), angleReader(), learnedReader(HAND_SET)]

describe('pose readers', () => {
  it('every reader reads all nine signs on a clean hand facing the camera', () => {
    for (const read of READERS) for (const pose of POSES) expect(read(hand(pose))).toBe(pose)
  })

  it('every reader reads an open hand as open and a fist as a fist', () => {
    for (const read of READERS) {
      expect(read(hand('1111'))).toBe('1111')
      expect(read(hand('0000'))).toBe('0000')
    }
  })

  it('the sign recogniser uses the distance rule unless given another reader', () => {
    for (const [layer, pose] of Object.entries(POSE_FOR)) {
      const frame = makeModelHand({ curl: curlForPose(pose) })
      expect(readSign(frame)).toBe(layer)
      expect(readSign(frame, { ...DEFAULT_SIGN_OPTIONS, reader: angleReader() })).toBe(layer)
      // A reader that sees nothing raised names no sign, whatever the hand is doing.
      expect(readSign(frame, { ...DEFAULT_SIGN_OPTIONS, reader: () => '0000' })).toBeNull()
    }
  })

  it('a straight finger has reach 1 and points with the palm; a folded one does neither', () => {
    const up = fingerFeatures(hand('1000', { aspect: 1 }), 0)
    const down = fingerFeatures(hand('0000', { aspect: 1 }), 0)
    expect(up.reach).toBeCloseTo(1, 6)
    expect(up.align).toBeGreaterThan(0.9)
    expect(up.middleBend).toBeCloseTo(-1, 6)
    expect(down.reach).toBeLessThan(0.6)
    expect(down.align).toBeLessThan(0.3)
  })

  it('the finger features do not change with the hand size or its turn in the picture', () => {
    const base = fingerFeatures(hand('1100', { aspect: 1 }), 1)
    for (const extra of [{ size: 0.1 }, { size: 0.4 }, { roll: 70 }, { roll: -120, size: 0.3 }]) {
      const f = fingerFeatures(hand('1100', { aspect: 1, ...extra }), 1)
      expect(f.reach).toBeCloseTo(base.reach, 8)
      expect(f.align).toBeCloseTo(base.align, 8)
    }
  })

  it('squarePixels undoes the stretch of a 4:3 picture', () => {
    const stretched = hand('1001', { aspect: 4 / 3, roll: 60 })
    const square = hand('1001', { aspect: 1, roll: 60 })
    expect(fingerFeatures(squarePixels(stretched, 4 / 3), 3).align).toBeCloseTo(fingerFeatures(square, 3).align, 8)
    expect(Math.abs(fingerFeatures(stretched, 3).align - fingerFeatures(square, 3).align)).toBeGreaterThan(1e-3)
  })

  it('flatten drops depth and nothing else', () => {
    const flat = flatten(hand('0110'))
    expect(flat.every((p) => p.z === 0)).toBe(true)
    expect(flat[8].x).toBe(hand('0110')[8].x)
  })
})
