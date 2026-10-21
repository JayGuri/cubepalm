import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { CLICK_EASING } from '../../motion/easing'
import { gridStagger, prefersReducedMotion, type StaggerFrom } from '../../motion/stagger'

// A face of a cube, or any grid of stickers on black plastic. When a sticker's
// colour changes it does not fade: it turns over, the old colour tipping away
// and the new one clicking into place, rippling out from one point. Hand it a
// scrambled set of colours and then a solved one, and it scrambles and solves.

export interface StickerGridProps {
  /** Sticker colours, row by row. */
  colours: string[]
  cols?: number
  /** One sticker's edge, in pixels. */
  sticker?: number
  /** The black between stickers, in pixels. */
  gap?: number
  /** Corner rounding of a sticker, as a share of its edge. */
  round?: number
  /** Where a change starts rippling from. */
  from?: StaggerFrom
  /** Milliseconds between one ring of stickers and the next. */
  each?: number
  /** Milliseconds for one sticker to turn over. */
  duration?: number
  /** Read out instead of hiding the drawing from screen readers. */
  label?: string
  className?: string
  style?: CSSProperties
}

export function StickerGrid({
  colours,
  cols = 3,
  sticker = 18,
  gap = 3,
  round = 0.2,
  from = 'center',
  each = 45,
  duration = 420,
  label,
  className = '',
  style,
}: StickerGridProps) {
  const rows = Math.ceil(colours.length / cols)
  const cells = useRef<(HTMLSpanElement | null)[]>([])
  const shown = useRef<string[]>(colours)

  // Before paint: every sticker whose colour changed starts showing the old
  // colour, then turns over to the new one in its turn.
  useLayoutEffect(() => {
    const before = shown.current
    shown.current = colours
    if (prefersReducedMotion()) return
    colours.forEach((colour, i) => {
      const old = before[i]
      const el = cells.current[i]
      if (!el || old === undefined || old === colour || typeof el.animate !== 'function') return
      el.animate(
        [
          { transform: 'perspective(160px) rotateX(0deg)', backgroundColor: old, easing: 'cubic-bezier(0.55, 0, 1, 0.45)' },
          { transform: 'perspective(160px) rotateX(90deg)', backgroundColor: old, offset: 0.4 },
          { transform: 'perspective(160px) rotateX(-90deg)', backgroundColor: colour, offset: 0.4001, easing: CLICK_EASING },
          { transform: 'perspective(160px) rotateX(0deg)', backgroundColor: colour },
        ],
        { duration, delay: gridStagger(i, { grid: [cols, rows], from, each }), fill: 'backwards' },
      )
    })
  }, [colours, cols, rows, from, each, duration])

  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`inline-grid bg-plastic ${className}`}
      style={{
        gridTemplateColumns: `repeat(${cols}, ${sticker}px)`,
        gap,
        padding: gap,
        borderRadius: sticker * round + gap,
        ...style,
      }}
    >
      {colours.map((colour, i) => (
        <span
          key={i}
          ref={(el) => void (cells.current[i] = el)}
          className="sticker block"
          style={{ width: sticker, height: sticker, borderRadius: sticker * round, backgroundColor: colour }}
        />
      ))}
    </div>
  )
}
