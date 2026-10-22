import { useEffect, useMemo, useRef, useState } from 'react'
import { StickerGrid } from '../../cube/StickerGrid'
import { TURN_EASING } from '../../../motion/easing'
import { useReducedMotion } from '../../../motion/stagger'
import { STICKER } from './buttonStyles'

// A tiny face of a cube that says how things stand. Its centre never moves and
// is always the colour of the place; the eight stickers round it are mixed
// while something is not done, and turn over to the centre's colour when it is.
// While something is being worked out the face turns, a quarter at a time.

export type FaceMode = 'solved' | 'scrambled' | 'thinking'

/** The stickers round the centre, row by row (cell 4 is the centre). */
const RING = [0, 1, 2, 3, 5, 6, 7, 8]
const MIXED =[STICKER.white, STICKER.red, STICKER.yellow, STICKER.blue, STICKER.orange, STICKER.green, STICKER.white, STICKER.red]

// Turn, rest, turn: four quarter turns a cycle, each landing with the detent.
const QUARTER_TURNS: Keyframe[] = [
  ...[0, 1, 2, 3].flatMap((q) => [
    { transform: `rotate(${q * 90}deg)`, offset: q / 4, easing: TURN_EASING },
    { transform: `rotate(${(q + 1) * 90}deg)`, offset: q / 4 + 0.1 },
  ]),
  { transform: 'rotate(360deg)', offset: 1 },
]

export function FaceGlyph({
  mode,
  colour,
  mixed = MIXED,
  sticker = 6,
  earn = false,
}: {
  mode: FaceMode
  /** The centre, and every sticker once solved. */
  colour: string
  /** The eight colours round the centre while it is not solved (keep the array's identity). */
  mixed?: readonly string[]
  /** One sticker's edge, in pixels. */
  sticker?: number
  /** Arrive mixed and settle at once, so a face that is already solved is seen being solved. */
  earn?: boolean
}) {
  const [arrived, setArrived] = useState(!earn)
  // One frame mixed, then it settles.
  useEffect(() => {
    if (arrived) return
    const frame = requestAnimationFrame(() => setArrived(true))
    return () => cancelAnimationFrame(frame)
  }, [arrived])
  const shown = arrived ? mode : 'scrambled'
  const colours = useMemo(() => {
    const c: string[] = Array(9).fill(colour)
    if (shown !== 'solved') RING.forEach((cell, i) => (c[cell] = mixed[i % mixed.length]))
    return c
  }, [shown, colour, mixed])

  const face = useRef<HTMLSpanElement>(null)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (shown !== 'thinking' || reduced || typeof face.current?.animate !== 'function') return
    const turning = face.current.animate(QUARTER_TURNS, { duration: 3200, iterations: Infinity })
    return () => turning.cancel()
  }, [shown, reduced])

  return (
    <span ref={face} aria-hidden className="inline-flex shrink-0">
      <StickerGrid colours={colours} sticker={sticker} gap={1} />
    </span>
  )
}
