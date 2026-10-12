import { describe, expect, it } from 'vitest'
import { dominantMethod, sanitizeUsage, summariseUsage, type UsageEvent } from './usageLog'

const turn = (m: 'drag' | 'keys' | 'buttons' | 'hands', gap: number | null, g: 'on' | 'off' | 'none' = 'none', at = 1000): UsageEvent => ({ k: 'turn', at, m, gap, g })

describe('the usage log', () => {
  it('keeps events it understands and drops everything else', () => {
    const good: UsageEvent[] = [turn('keys', null), turn('hands', 640, 'on'), { k: 'undo', at: 5 }, { k: 'solve', at: 9, ms: 61000, moves: 58, m: 'keys', help: false, ranked: true }]
    const junk = [null, 7, 'text', { k: 'turn', at: 1, m: 'telepathy', gap: 1, g: 'none' }, { k: 'turn', at: -5, m: 'keys', gap: 1, g: 'none' }, { k: 'solve', at: 1, ms: 'fast' }, { k: 'unknown', at: 1 }]
    expect(sanitizeUsage([...good, ...junk])).toEqual(good)
    for (const notAList of [null, {}, 'x', 3]) expect(sanitizeUsage(notAList)).toEqual([])
  })

  it('reports each method on its own', () => {
    const events = [...Array.from({ length: 6 }, () => turn('keys', 400)), ...Array.from({ length: 6 }, () => turn('hands', 1200))]
    const { methods, turns } = summariseUsage(events)
    const by = (m: string) => methods.find((x) => x.method === m)!
    expect(turns).toBe(12)
    expect(by('keys').medianGapMs).toBe(400)
    expect(by('keys').turnsPerMinute).toBe(150)
    expect(by('hands').medianGapMs).toBe(1200)
    expect(by('drag').turns).toBe(0)
  })

  it('leaves pauses to think out of the pace', () => {
    const events = [...Array.from({ length: 5 }, () => turn('keys', 500)), turn('keys', 45_000), turn('keys', 30_000)]
    expect(summariseUsage(events).methods.find((m) => m.method === 'keys')!.medianGapMs).toBe(500)
  })

  it('says nothing about pace or mistakes from fewer than five turns', () => {
    const { methods } = summariseUsage([turn('drag', 300, 'on'), turn('drag', 300, 'off'), turn('drag', 300, 'on')])
    const drag = methods.find((m) => m.method === 'drag')!
    expect(drag.turns).toBe(3)
    expect(drag.medianGapMs).toBeNull()
    expect(drag.offTrackRate).toBeNull()
  })

  it('counts turns off the guide only among turns made with the guide up', () => {
    const events = [...Array.from({ length: 8 }, () => turn('hands', 900, 'on')), turn('hands', 900, 'off'), turn('hands', 900, 'off'), ...Array.from({ length: 20 }, () => turn('hands', 900, 'none'))]
    const hands = summariseUsage(events).methods.find((m) => m.method === 'hands')!
    expect(hands.guided).toBe(10)
    expect(hands.offTrackRate).toBeCloseTo(0.2, 10)
  })

  it('counts only unassisted solves of random scrambles, and counts undos', () => {
    const solve = (ms: number, help: boolean, ranked: boolean): UsageEvent => ({ k: 'solve', at: 1, ms, moves: 60, m: 'keys', help, ranked })
    const { methods, undos } = summariseUsage([solve(90_000, false, true), solve(70_000, false, true), solve(110_000, false, true), solve(5_000, true, true), solve(3_000, false, false), { k: 'undo', at: 2 }, { k: 'undo', at: 3 }])
    const keys = methods.find((m) => m.method === 'keys')!
    expect(keys.solves).toBe(3)
    expect(keys.medianSolveMs).toBe(90_000)
    expect(undos).toBe(2)
  })

  it('names the method most turns were made with', () => {
    expect(dominantMethod(['keys', 'hands', 'hands', 'drag', 'hands'])).toBe('hands')
    expect(dominantMethod([])).toBe('drag')
  })
})
