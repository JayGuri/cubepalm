import { describe, expect, it } from 'vitest'
import { sanitize } from './settingsStore'

const DEFAULTS = { colorblindPalette: false, defaultInputMode: 'mouse', swapHands: false, turnSpeed: 'normal' }

describe('stored settings', () => {
  it('keeps values the app understands', () => {
    const good = { colorblindPalette: true, defaultInputMode: 'hands', swapHands: true, turnSpeed: 'fast' }
    expect(sanitize(good)).toEqual(good)
  })

  it('replaces each unknown value with its default, one field at a time', () => {
    expect(sanitize({ colorblindPalette: 'yes', defaultInputMode: 'camera', swapHands: 123, turnSpeed: 'warp' })).toEqual(DEFAULTS)
    expect(sanitize({ colorblindPalette: true, defaultInputMode: 'camera' })).toEqual({ ...DEFAULTS, colorblindPalette: true })
  })

  it('survives storage that is not an object at all', () => {
    for (const junk of [null, 7, 'text', [], undefined]) expect(sanitize(junk)).toEqual(DEFAULTS)
  })

  it('drops fields it does not know', () => {
    expect(sanitize({ ...DEFAULTS, admin: true })).toEqual(DEFAULTS)
  })
})
