import { describe, expect, it } from 'vitest'
import { distance } from './landmarkMath'
import { curlForPose, FINGER_JOINTS, FINGERS, makeModelHand, type HandPose } from './handModel'
import { POSE_FOR } from './signGestures'

type Curl = [number, number, number, number]

const tipToWrist = (curl: Curl, finger: number, extra: Partial<HandPose> = {}) => {
  const { landmarks } = makeModelHand({ curl, aspect: 1, ...extra })
  return distance(landmarks[FINGER_JOINTS[FINGERS[finger]][3]], landmarks[0])
}

describe('the hand model', () => {
  it('gives the 21 landmarks MediaPipe does', () => {
    const hand = makeModelHand({ curl: [0, 0, 0, 0] })
    expect(hand.landmarks).toHaveLength(21)
    for (const p of hand.landmarks) expect(Number.isFinite(p.x + p.y + p.z)).toBe(true)
  })

  it('a finger reaches less far from the wrist the more it curls', () => {
    for (let finger = 0; finger < 4; finger++) {
      const reach = [0, 0.5, 1].map((c) => tipToWrist([c, c, c, c], finger))
      expect(reach[0]).toBeGreaterThan(reach[1])
      expect(reach[1]).toBeGreaterThan(reach[2])
    }
  })

  it('the little finger reaches least and the middle finger most', () => {
    const reach = [0, 1, 2, 3].map((finger) => tipToWrist([0, 0, 0, 0], finger))
    expect(Math.max(...reach)).toBe(reach[1])
    expect(Math.min(...reach)).toBe(reach[3])
  })

  it('turning the hand in the picture does not change its shape, on square pixels', () => {
    const upright = tipToWrist([0, 1, 0, 1], 0)
    for (const roll of [30, 90, 180, -45]) expect(tipToWrist([0, 1, 0, 1], 0, { roll })).toBeCloseTo(upright, 10)
  })

  it('on a 4:3 picture the same hand measures shorter sideways than upright', () => {
    const upright = tipToWrist([0, 0, 0, 0], 1, { aspect: 4 / 3 })
    const sideways = tipToWrist([0, 0, 0, 0], 1, { aspect: 4 / 3, roll: 90 })
    expect(sideways).toBeLessThan(upright * 0.8)
  })

  it('a left hand is the mirror image of a right hand', () => {
    const right = makeModelHand({ curl: [0, 1, 1, 0], at: [0.5, 0.5] }).landmarks
    const left = makeModelHand({ curl: [0, 1, 1, 0], at: [0.5, 0.5], handedness: 'Left' }).landmarks
    right.forEach((p, i) => {
      expect(left[i].x).toBeCloseTo(1 - p.x, 10)
      expect(left[i].y).toBeCloseTo(p.y, 10)
    })
  })

  it('noise needs a source, and the same source gives the same hand', () => {
    expect(() => makeModelHand({ curl: [0, 0, 0, 0], noise: 0.02 })).toThrow(/gaussian/)
    const source = () => {
      let n = 0
      return () => Math.sin(++n)
    }
    const a = makeModelHand({ curl: [0, 0, 0, 0], noise: 0.02, gaussian: source() })
    const b = makeModelHand({ curl: [0, 0, 0, 0], noise: 0.02, gaussian: source() })
    expect(a.landmarks).toEqual(b.landmarks)
    expect(a.landmarks).not.toEqual(makeModelHand({ curl: [0, 0, 0, 0] }).landmarks)
  })

  it('can make every sign', () => {
    for (const pose of Object.values(POSE_FOR)) {
      const curl = curlForPose(pose)
      expect(curl.map((c) => (c === 0 ? '1' : '0')).join('')).toBe(pose)
    }
  })
})
