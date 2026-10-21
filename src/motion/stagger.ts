import { useSyncExternalStore } from 'react'

// When each piece of a grid starts moving. A face of a cube is a 3x3 grid, so
// most of the site's choreography is a grid: stickers flipping outward from the
// centre, tiles folding out of a net. Delays grow with the distance from where
// the motion starts, the way a ripple leaves the point where a stone went in.

export type StaggerFrom = 'center' | 'first' | 'last' | number

export interface GridStagger {
  /** Columns and rows. */
  grid: [number, number]
  /** Where the motion starts: the middle, the first or last cell, or a cell index. */
  from?: StaggerFrom
  /** Milliseconds per cell of distance. */
  each?: number
  /** Added to every delay. */
  start?: number
}

/** The delay, in milliseconds, before cell `index` of a grid starts to move. */
export function gridStagger(index: number, { grid: [cols, rows], from = 'center', each = 40, start = 0 }: GridStagger): number {
  const col = index % cols
  const row = Math.floor(index / cols)
  let fromCol: number
  let fromRow: number
  if (from === 'center') {
    fromCol = (cols - 1) / 2
    fromRow = (rows - 1) / 2
  } else {
    const at = from === 'first' ? 0 : from === 'last' ? cols * rows - 1 : from
    fromCol = at % cols
    fromRow = Math.floor(at / cols)
  }
  return start + Math.hypot(col - fromCol, row - fromRow) * each
}

// Whether the person has asked for less motion, kept current if they change it
// while the page is open.
const query = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
const subscribe = (onChange: () => void) => {
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}
export const prefersReducedMotion = () => Boolean(query?.matches)

/** True when the person has asked their system for less motion. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false)
}
