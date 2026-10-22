import { useMemo } from 'react'
import { StickerGrid } from '../cube/StickerGrid'
import { CUBE, dim, scrambled, useSolvedAfterMount } from './scramble'

// Faces for the white face's pages: a scrambled set of stickers that solves.

/** The page's mark: a face of one colour, which solves as the page opens. */
export function FaceMark({ colour = CUBE.white, sticker = 10 }: { colour?: string; sticker?: number }) {
  const solved = useSolvedAfterMount()
  const colours = useMemo(() => (solved ? Array<string>(9).fill(colour) : scrambled(9, [colour], 2)), [solved, colour])
  return <StickerGrid colours={colours} sticker={sticker} gap={2} each={55} className="shrink-0" />
}

const HAND = { Right: '#FFD500', Left: '#4CC9F0' } as const
const PER_HAND = 12

/**
 * The 24 recorder shapes as two faces of stickers, the right hand's then the left's.
 * A sticker not yet recorded is scrambled and dim; a recorded one turns over into its
 * hand's colour. `current` rings the shape being asked for (red while recording).
 */
export function HandFaces({ filled, current = null, live = false, sticker = 13, gap = 3 }: { filled: number; current?: number | null; live?: boolean; sticker?: number; gap?: number }) {
  return (
    <div className="flex gap-3">
      {(['Right', 'Left'] as const).map((hand, h) => (
        <HandFace key={hand} hand={hand} filled={Math.max(0, Math.min(PER_HAND, filled - h * PER_HAND))} current={current !== null && Math.floor(current / PER_HAND) === h ? current % PER_HAND : null} live={live} sticker={sticker} gap={gap} />
      ))}
    </div>
  )
}

function HandFace({ hand, filled, current, live, sticker, gap }: { hand: 'Right' | 'Left'; filled: number; current: number | null; live: boolean; sticker: number; gap: number }) {
  const colour = HAND[hand]
  const jumble = useMemo(() => scrambled(PER_HAND, hand === 'Right' ? [CUBE.yellow] : [CUBE.blue], hand === 'Right' ? 0 : 3).map((c) => dim(c)), [hand])
  const colours = useMemo(() => jumble.map((c, i) => (i < filled ? colour : c)), [jumble, filled, colour])
  const step = sticker + gap
  return (
    <figure className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <StickerGrid colours={colours} sticker={sticker} gap={gap} />
        {current !== null && (
          <span
            aria-hidden
            className="pg-cursor"
            data-live={live}
            style={{
              width: sticker + 4,
              height: sticker + 4,
              borderRadius: sticker * 0.2 + 2,
              translate: `${gap - 2 + (current % 3) * step}px ${gap - 2 + Math.floor(current / 3) * step}px`,
            }}
          />
        )}
      </div>
      <figcaption className="text-xs font-bold" style={{ color: colour }}>
        {hand}
      </figcaption>
    </figure>
  )
}
