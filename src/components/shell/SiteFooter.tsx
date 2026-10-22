import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { StickerGrid } from '../cube/StickerGrid'
import { Logo } from '../Logo'
import { prefersReducedMotion } from '../../motion/stagger'
import { GITHUB, STICKER } from './places'

// The foot of every content page is the cube's last layer: the twelve stickers
// round its side, one algorithm from solved, that solve as they come into view.
// Under them, the ways on, each beside the colour of its face.

const { orange: O, green: G, red: R, blue: B, white: W, yellow: Y } = STICKER
// A real last-layer position, three edges to cycle (a U perm), and solved.
const UNSOLVED = [O, O, O, G, R, G, R, B, R, B, G, B]
const SOLVED = [O, O, O, G, G, G, R, R, R, B, B, B]

function LastLayer() {
  const ref = useRef<HTMLDivElement>(null)
  const [solved, setSolved] = useState(prefersReducedMotion)
  useEffect(() => {
    const el = ref.current
    if (solved || !el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSolved(true), { threshold: 1, rootMargin: '0px 0px -40px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [solved])
  return (
    <div ref={ref} className="w-fit">
      <StickerGrid colours={solved ? SOLVED : UNSOLVED} cols={12} sticker={19} gap={3} from="first" each={38} duration={420} />
    </div>
  )
}

const LINK = 'inline-flex min-h-9 items-center text-fg-muted underline decoration-white/0 underline-offset-4 transition-colors hover:text-fg hover:decoration-white/40 pointer-coarse:min-h-11'

function Row({ colour, title, children }: { colour: string; title: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-start gap-x-4">
      <dt className="flex min-h-9 items-center gap-2.5 font-display font-bold text-fg pointer-coarse:min-h-11">
        <span aria-hidden className="sticker size-3 shrink-0 rounded-[3px]" style={{ background: colour }} />
        {title}
      </dt>
      <dd className="flex flex-wrap gap-x-5">{children}</dd>
    </div>
  )
}

const out = { target: '_blank', rel: 'noreferrer' } as const

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-white/8 pt-10 text-sm sm:mt-28">
      <div className="flex flex-col gap-10 md:flex-row md:justify-between">
        <div className="flex flex-col gap-5">
          <span className="text-fg">
            <Logo size={32} />
          </span>
          <LastLayer />
        </div>
        <dl className="flex flex-col gap-1 md:min-w-96">
          <Row colour={G} title="Play">
            <Link to="/play/cube3" className={LINK}>
              3×3 cube
            </Link>
            <Link to="/play/mirror" className={LINK}>
              Mirror Cube
            </Link>
          </Row>
          <Row colour={O} title="Learn">
            <Link to="/learn" className={LINK}>
              Eight lessons
            </Link>
          </Row>
          <Row colour={R} title="How it works">
            <Link to="/how" className={LINK}>
              The maths
            </Link>
            <a href={`${GITHUB}/blob/main/docs/REPORT.md`} {...out} className={LINK}>
              The report
            </a>
            <a href={GITHUB} {...out} className={LINK}>
              Source code
            </a>
          </Row>
          <Row colour={W} title="Yours">
            <Link to="/settings" className={LINK}>
              Settings
            </Link>
            <Link to="/stats" className={LINK}>
              Your stats
            </Link>
          </Row>
        </dl>
      </div>
      <div className="mt-10 flex flex-col gap-2 border-t border-white/6 py-6 text-fg-faint sm:flex-row sm:justify-between sm:gap-6">
        <p>
          Made by{' '}
          <a href="https://github.com/JayGuri" {...out} className="text-fg underline decoration-white/40 underline-offset-4 hover:decoration-white">
            Jay Guri
          </a>
          .
        </p>
        <p className="max-w-md sm:text-right">
          <span aria-hidden className="mr-2 inline-block size-2 rounded-xs align-middle" style={{ background: Y }} />
          Everything runs in your browser. Your camera, your progress and your settings stay on this device.
        </p>
      </div>
    </footer>
  )
}
