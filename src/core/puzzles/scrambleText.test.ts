import { describe, expect, it } from 'vitest'
import { MAX_SCRAMBLE_TURNS, parseScramble } from './scrambleText'

describe('reading a typed scramble', () => {
  it('reads face turns, reversed turns and half turns', () => {
    expect(parseScramble("R U2 F' L D2 B")).toEqual({ turns: ['R', 'U2', "F'", 'L', 'D2', 'B'], error: null })
  })

  it('takes spaces, commas and line breaks between turns', () => {
    expect(parseScramble(`  R,U2,
F'   L `).turns).toEqual(['R', 'U2', "F'", 'L'])
  })

  it('reads what people really paste: curly apostrophes, and a prime on a half turn', () => {
    expect(parseScramble('R’ U′').turns).toEqual(["R'", "U'"])
    expect(parseScramble("R2' F'2")).toEqual({ turns: ['R2', 'F2'], error: null })
  })

  it('an empty box is a solved cube, not a mistake', () => {
    expect(parseScramble('   ')).toEqual({ turns: [], error: null })
  })

  it('names the first thing it cannot read, and keeps what came before it', () => {
    const { turns, error } = parseScramble('R U x F')
    expect(turns).toEqual(['R', 'U'])
    expect(error).toContain('"x" is not a turn')
  })

  it('says what to do about a lower-case letter', () => {
    expect(parseScramble("R u' F").error).toContain("capitals: U'")
  })

  it('refuses turns this cube does not have', () => {
    for (const bad of ['M', 'x', 'Rw', 'R3', "R''", '2R', 'RU']) expect(parseScramble(bad).error, bad).not.toBeNull()
  })

  it('refuses a scramble that is absurdly long', () => {
    const long = Array(MAX_SCRAMBLE_TURNS + 1).fill('R').join(' ')
    expect(parseScramble(long).error).toContain(String(MAX_SCRAMBLE_TURNS))
    expect(parseScramble(Array(MAX_SCRAMBLE_TURNS).fill('R').join(' ')).error).toBeNull()
  })
})
