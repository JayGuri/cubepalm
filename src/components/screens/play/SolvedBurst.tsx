import { useLayoutEffect, useRef, useState } from 'react'
import { CLICK_EASING, SOFT_EASING } from '../../../motion/easing'
import { prefersReducedMotion } from '../../../motion/stagger'
import { PANEL, STICKER } from './buttonStyles'

// The moment a scrambled cube comes back solved. The cube on the stage becomes
// the centre of a face as big as the stage: the eight stickers round it arrive
// in mixed colours, turn over one after another round the ring to the solved
// colour, and are gone in about a second. It lies under every panel and
// control and takes no clicks. For anyone who has asked for less motion it is
// a plain word instead, for a moment.

// Round the centre clockwise from the top, as [column, row].
const RING: [number, number][] = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]
const FROM = [STICKER.red, STICKER.blue, STICKER.white, STICKER.orange, STICKER.yellow, STICKER.green, STICKER.red, STICKER.blue]

export function SolvedBurst({ colour, label = 'Solved' }: { colour: string; label?: string }) {
  // Decided once, when the cube is solved.
  const [reduced] = useState(prefersReducedMotion)
  const stage = useRef<HTMLDivElement>(null)
  const stickers = useRef<(HTMLSpanElement | null)[]>([])
  const [said, setSaid] = useState(reduced)

  useLayoutEffect(() => {
    if (reduced) {
      const t = window.setTimeout(() => setSaid(false), 2400)
      return () => window.clearTimeout(t)
    }
    const box = stage.current?.getBoundingClientRect()
    if (!box) return
    // The cube fills about two thirds of the stage's shorter side; the ring sits just outside it.
    const m = Math.min(box.width, box.height)
    const size = m * 0.1
    stickers.current.forEach((el, i) => {
      if (!el || typeof el.animate !== 'function') return
      const [x, y] = RING[i]
      Object.assign(el.style, {
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${size * 0.2}px`,
        left: `${box.width / 2 + x * Math.min(m * 0.45, box.width / 2 - size * 0.7)}px`,
        top: `${box.height * 0.51 + y * Math.min(m * 0.45, box.height / 2 - size * 0.7)}px`,
      })
      el.animate(
        [
          { opacity: 0, transform: 'perspective(400px) scale(0.5)', backgroundColor: FROM[i], easing: SOFT_EASING },
          { opacity: 1, transform: 'perspective(400px) scale(1) rotateX(0deg)', backgroundColor: FROM[i], offset: 0.24, easing: 'cubic-bezier(0.55, 0, 1, 0.45)' },
          { transform: 'perspective(400px) rotateX(90deg)', backgroundColor: FROM[i], offset: 0.42 },
          { transform: 'perspective(400px) rotateX(-90deg)', backgroundColor: colour, offset: 0.4201, easing: CLICK_EASING },
          { opacity: 1, transform: 'perspective(400px) rotateX(0deg)', backgroundColor: colour, offset: 0.7 },
          { opacity: 1, transform: 'perspective(400px) scale(1)', backgroundColor: colour, offset: 0.84, easing: 'ease-in' },
          { opacity: 0, transform: 'perspective(400px) scale(0.9)', backgroundColor: colour },
        ],
        { duration: 1000, delay: i * 40, fill: 'both' },
      )
    })
  }, [reduced, colour])

  return (
    <div ref={stage} aria-hidden data-testid="solved-burst" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {!reduced &&
        RING.map((_, i) => (
          <span key={i} ref={(el) => void (stickers.current[i] = el)} className="sticker absolute -translate-x-1/2 -translate-y-1/2 opacity-0" />
        ))}
      {said && <p className={`absolute bottom-[18%] left-1/2 -translate-x-1/2 rounded-lg px-3 py-1.5 text-sm font-semibold text-fg ${PANEL}`}>{label}</p>}
    </div>
  )
}
