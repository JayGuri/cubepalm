import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../Logo'
import { ColourStrip } from '../SiteNav'
import { GITHUB, STICKER } from './places'

// The foot of every content page: the cube's six colours as a bold strip, the
// logo, and the ways on, each group wearing the colour of its face.

const LINK =
  'inline-flex min-h-9 items-center text-fg-muted transition duration-200 hover:-translate-y-0.5 hover:text-fg pointer-coarse:min-h-11'

function Group({ colour, title, children }: { colour: string; title: string; children: ReactNode }) {
  return (
    <div className="min-w-28">
      <p className="font-display text-base font-extrabold" style={{ color: colour }}>
        {title}
      </p>
      <div className="mt-1 flex flex-col">{children}</div>
    </div>
  )
}

const out = { target: '_blank', rel: 'noreferrer' } as const

export function SiteFooter() {
  return (
    <footer className="mt-20 pt-2 text-sm sm:mt-28">
      <ColourStrip />
      <div className="mt-10 flex flex-col gap-10 lg:flex-row lg:justify-between">
        <div className="flex max-w-xs flex-col gap-4">
          <span className="text-fg">
            <Logo size={36} />
          </span>
          <p className="text-fg-muted">
            A Rubik&rsquo;s Cube you turn with your hands. Everything runs in your browser: your camera, your progress and your settings stay on this device.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4">
          <Group colour={STICKER.green} title="Play">
            <Link to="/play/cube3" className={LINK}>
              3×3 cube
            </Link>
            <Link to="/play/mirror" className={LINK}>
              Mirror Cube
            </Link>
          </Group>
          <Group colour={STICKER.orange} title="Learn">
            <Link to="/learn" className={LINK}>
              Eight lessons
            </Link>
          </Group>
          <Group colour={STICKER.red} title="How it works">
            <Link to="/how" className={LINK}>
              The maths
            </Link>
            <a href={`${GITHUB}/blob/main/docs/REPORT.md`} {...out} className={LINK}>
              The report
            </a>
            <a href={GITHUB} {...out} className={LINK}>
              Source code
            </a>
          </Group>
          <Group colour={STICKER.white} title="Yours">
            <Link to="/settings" className={LINK}>
              Settings
            </Link>
            <Link to="/stats" className={LINK}>
              Your stats
            </Link>
          </Group>
        </nav>
      </div>
      <p className="mt-10 border-t border-white/10 py-6 text-fg-faint">
        Made by{' '}
        <a href="https://github.com/JayGuri" {...out} className="text-fg underline decoration-white/40 underline-offset-4 hover:decoration-white">
          Jay Guri
        </a>
        .
      </p>
    </footer>
  )
}
