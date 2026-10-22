import { describe, expect, it } from 'vitest'
import { clickLevel } from './turnFeel'

describe('clickLevel', () => {
  it('drops clicks that come too close together', () => {
    expect(clickLevel(0)).toBe(0)
    expect(clickLevel(69)).toBe(0)
  })
  it('plays a lone turn at full level and a run of turns softer', () => {
    expect(clickLevel(Infinity)).toBe(1)
    expect(clickLevel(1000)).toBe(1)
    const fast = clickLevel(80)
    const dealt = clickLevel(220)
    expect(fast).toBeGreaterThan(0.5)
    expect(dealt).toBeGreaterThan(fast)
    expect(dealt).toBeLessThan(1)
  })
})
