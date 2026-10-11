import { describe, expect, it } from 'vitest'
import { curlForPose, makeModelHand, type HandPose } from './handModel'
import type { LandmarkFrame } from './landmarks'
import { OneEuro } from './oneEuro'
import { createSmoother, signOptions } from './signReading'
import { createSignState, DEFAULT_SIGN_OPTIONS, POSE_FOR, readSign, stepSigns, type SignLayer, type SignOptions } from './signGestures'

const FRAME_MS = 40

/** Plays frames through the recogniser; `hand(t)` returns null when the tracker has lost the hand. */
function play(hand: (timeMs: number) => HandPose | null, durationMs: number, options: SignOptions, aspect = 4 / 3) {
  let state = createSignState()
  const turns: Array<{ layer: SignLayer; timeMs: number }> = []
  for (let t = 0; t <= durationMs; t += FRAME_MS) {
    const pose = hand(t)
    const frame: LandmarkFrame = { hands: pose ? [makeModelHand({ aspect, ...pose })] : [], timestampMs: t, aspect }
    const step = stepSigns(state, frame, options)
    state = step.next
    for (const e of step.events) turns.push({ layer: e.layer, timeMs: t })
  }
  return turns
}

const holding = (layer: SignLayer): HandPose => ({ curl: curlForPose(POSE_FOR[layer]) })

describe('a hand the tracker loses for a moment', () => {
  // Two frames in every five missing: the hand never left, the tracker blinked.
  const lost = (t: number) => (t / FRAME_MS) % 5 >= 3
  const blinking = (t: number) => (lost(t) ? null : holding('U'))

  it('still turns once, and on time', () => {
    const turns = play(blinking, 2000, DEFAULT_SIGN_OPTIONS)
    expect(turns.map((t) => t.layer)).toEqual(['U'])
    expect(turns[0].timeMs).toBeLessThan(1000)
  })

  it('without the grace period the same hand is late, or turns more than once', () => {
    const turns = play(blinking, 2000, { ...DEFAULT_SIGN_OPTIONS, dropGraceMs: 0 })
    expect(turns.length !== 1 || turns[0].timeMs >= 1000).toBe(true)
  })

  it('never turns on a frame with no hand in it', () => {
    const turns = play(blinking, 2000, DEFAULT_SIGN_OPTIONS)
    expect(turns).toHaveLength(1)
    for (const turn of turns) expect(lost(turn.timeMs)).toBe(false)
  })

  it('a hand that really goes away lets go of the sign, so showing it again turns again', () => {
    const gone = (t: number) => (t < 1000 || t >= 2000 ? holding('R') : null)
    expect(play(gone, 3200, DEFAULT_SIGN_OPTIONS).map((t) => t.layer)).toEqual(['R', 'R'])
  })

  it('a sign shown too briefly before the hand leaves turns nothing', () => {
    const brief = (t: number) => (t < 300 ? holding('F') : null)
    expect(play(brief, 2000, DEFAULT_SIGN_OPTIONS)).toEqual([])
  })
})

describe('precise sign reading', () => {
  const precise = signOptions('precise', false)

  it('reads every sign on a clean hand, as classic does', () => {
    for (const [layer, pose] of Object.entries(POSE_FOR)) {
      const hand = makeModelHand({ curl: curlForPose(pose), aspect: 1 })
      expect(readSign(hand, precise)).toBe(layer)
      expect(readSign(hand, signOptions('classic', false))).toBe(layer)
    }
  })

  it('reads a half-open, relaxed hand as no sign at all', () => {
    for (const curl of [0.45, 0.5, 0.55]) {
      expect(readSign(makeModelHand({ curl: [curl, curl, curl, curl], aspect: 1 }), precise)).toBeNull()
    }
  })

  it('reads a sign the same whichever way the hand is turned in a 4:3 picture', () => {
    for (const roll of [0, 20, 45, 70, 90]) {
      const turns = play(() => ({ ...holding('L'), roll }), 1500, precise)
      expect(turns.map((t) => t.layer), `roll ${roll}`).toEqual(['L'])
    }
  })

  it('passes the swap-hands setting through in both modes', () => {
    expect(signOptions('classic', true).swapHands).toBe(true)
    expect(precise.swapHands).toBe(false)
    expect(signOptions('classic', false).reader).toBeUndefined()
  })
})

describe('the smoothing filter', () => {
  it('leaves a steady value alone and settles on a new one', () => {
    const filter = new OneEuro()
    for (let t = 0; t < 400; t += FRAME_MS) expect(filter.next(0.5, t)).toBeCloseTo(0.5, 10)
    let value = 0
    for (let t = 400; t < 3000; t += FRAME_MS) value = filter.next(0.9, t)
    expect(value).toBeCloseTo(0.9, 2)
  })

  it('reduces jitter around a still value', () => {
    const filter = new OneEuro()
    const noisy = Array.from({ length: 200 }, (_, i) => 0.5 + 0.01 * Math.sin(i * 12.9898) * Math.cos(i * 78.233))
    const out = noisy.map((v, i) => filter.next(v, i * FRAME_MS))
    const spread = (values: number[]) => Math.max(...values.slice(20)) - Math.min(...values.slice(20))
    expect(spread(out)).toBeLessThan(spread(noisy) * 0.6)
  })

  it('ignores a repeated timestamp instead of dividing by zero', () => {
    const filter = new OneEuro()
    filter.next(0.2, 100)
    expect(Number.isFinite(filter.next(0.9, 100))).toBe(true)
  })

  it('starts a hand afresh after it has been gone a while', () => {
    const smooth = createSmoother(400)
    const at = (x: number, timestampMs: number): LandmarkFrame => ({ hands: [makeModelHand({ curl: [0, 0, 0, 0], at: [x, 0.7] })], timestampMs })
    for (let t = 0; t < 400; t += FRAME_MS) smooth(at(0.2, t))
    // Back after a second, somewhere else: no trail from the old position.
    const back = smooth(at(0.8, 1400))
    expect(back.hands[0].landmarks[0].x).toBeCloseTo(at(0.8, 1400).hands[0].landmarks[0].x, 10)
  })
})
