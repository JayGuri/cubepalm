import { useEffect, useState } from 'react'
import { prefersReducedMotion } from '../../motion/stagger'

// Scrambled stickers, and the moment they solve.

export const CUBE = { white: '#F4F5F8', yellow: '#FFD500', red: '#F0566B', orange: '#FF8A00', green: '#2FB36B', blue: '#5B8DEF' }

/** A colour sunk toward the black plastic: a sticker not yet in play. */
export function dim(hex: string, keep = 0.5): string {
  const mix = (i: number) => Math.round(parseInt(hex.slice(i, i + 2), 16) * keep + [14, 15, 19][(i - 1) / 2] * (1 - keep))
  return `#${[1, 3, 5].map((i) => mix(i).toString(16).padStart(2, '0')).join('')}`
}

/** A fixed jumble of cube colours, leaving out the ones named (so a scrambled sticker is never mistaken for a solved one). */
export function scrambled(n: number, leaveOut: string[] = [], seed = 0): string[] {
  const pool = Object.values(CUBE).filter((c) => !leaveOut.includes(c))
  const out: string[] = []
  let h = seed * 977 + 13
  for (let i = 0; i < n; i++) {
    h = (h * 48271) % 2147483647
    let pick = h % pool.length
    // No sticker matches the one beside it or above it (rows of three), so it reads as mixed.
    while ((i % 3 > 0 && pool[pick] === out[i - 1]) || pool[pick] === out[i - 3]) pick = (pick + 1) % pool.length
    out.push(pool[pick])
  }
  return out
}

/** False on the first paint, true just after: hand a StickerGrid scrambled colours, then solved ones, and it solves. */
export function useSolvedAfterMount(): boolean {
  const [solved, setSolved] = useState(prefersReducedMotion)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSolved(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  return solved
}

