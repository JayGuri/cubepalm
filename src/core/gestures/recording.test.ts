import { describe, expect, it } from 'vitest'
import { curlForPose, makeModelHand } from './handModel'
import { distanceReader } from './poseReaders'
import { CLIP_LABELS, expectedPose, packFrame, parseRecording, unpackPoints, type Recording } from './recording'
import { POSE_FOR } from './signGestures'

const frameOf = (pose: string, timestampMs: number) => ({ hands: [makeModelHand({ curl: curlForPose(pose) })], timestampMs, aspect: 4 / 3 })

describe('hand recordings', () => {
  it('asks for every sign and three hands that are not signs', () => {
    expect(CLIP_LABELS).toHaveLength(12)
    for (const [layer, pose] of Object.entries(POSE_FOR)) expect(expectedPose(layer as keyof typeof POSE_FOR)).toBe(pose)
    expect(expectedPose('open')).toBe('1111')
    expect(expectedPose('fist')).toBe('0000')
    // A relaxed hand has no right answer, only a wrong one.
    expect(expectedPose('relaxed')).toBeNull()
  })

  it('a packed frame unpacks to the same hand, to four decimals', () => {
    const frame = frameOf('1100', 5040)
    const packed = packFrame(frame, 5000)
    expect(packed.t).toBe(40)
    expect(packed.aspect).toBeCloseTo(4 / 3, 3)
    expect(packed.hands[0].points).toHaveLength(63)
    const back = unpackPoints(packed.hands[0].points)
    frame.hands[0].landmarks.forEach((p, i) => {
      expect(back[i].x).toBeCloseTo(p.x, 4)
      expect(back[i].y).toBeCloseTo(p.y, 4)
      expect(back[i].z).toBeCloseTo(p.z, 4)
    })
    // Rounding must not change what the hand is read as.
    expect(distanceReader()(back)).toBe('1100')
  })

  it('holds no picture: only numbers and labels', () => {
    const text = JSON.stringify(packFrame(frameOf('1000', 0), 0))
    expect(text).not.toMatch(/data:|image|video|blob/i)
  })

  it('reads back a well-formed recording unchanged', () => {
    const recording: Recording = {
      version: 1,
      recordedAt: '2026-10-11T10:00:00.000Z',
      conditions: { lighting: 'dim', distance: 'far', device: 'phone' },
      camera: { width: 480, height: 640 },
      clips: [{ label: 'R', hand: 'Right', frames: [packFrame(frameOf('1000', 0), 0), packFrame(frameOf('1000', 40), 0)] }],
    }
    expect(parseRecording(JSON.parse(JSON.stringify(recording)))).toEqual(recording)
  })

  it('drops what is malformed and refuses what is not a recording', () => {
    for (const junk of [null, 5, 'x', {}, { version: 2, clips: [] }, { version: 1 }]) expect(parseRecording(junk)).toBeNull()
    const parsed = parseRecording({
      version: 1,
      clips: [
        { label: 'R', hand: 'Right', frames: [{ t: 0, hands: [{ handedness: 'Right', score: 1, points: [1, 2, 3] }] }, 'nonsense'] },
        { label: 'not-a-sign', hand: 'Right', frames: [] },
        { label: 'U', hand: 'Sideways', frames: [] },
      ],
    })!
    expect(parsed.clips).toHaveLength(1)
    // The frame is kept (its time matters); the hand with too few points is not.
    expect(parsed.clips[0].frames).toEqual([{ t: 0, aspect: null, hands: [] }])
    // Anything not stated falls back to the commonest case, and a missing camera size stays unknown.
    expect(parsed.conditions).toEqual({ lighting: 'bright', distance: 'near', device: 'computer' })
    expect(parsed.camera).toBeNull()
  })
})
