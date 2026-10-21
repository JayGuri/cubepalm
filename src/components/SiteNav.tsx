import { NavLink } from 'react-router-dom'
import { Logo } from './Logo'

const GITHUB = 'https://github.com/JayGuri/cubepalm'

// One tile per colour of the cube. Each is a way into the app, so the palette
// the whole site is built on is also the menu.
const TILES = [
  { label: 'Learn', to: '/learn', colour: '#FF8A00' },
  { label: '3×3', to: '/play/cube3', colour: '#2FB36B' },
  { label: 'Mirror', to: '/play/mirror', colour: '#5B8DEF' },
  { label: 'Settings', to: '/settings', colour: '#F4F5F8' },
  { label: 'Maths', to: '/how', colour: '#F0566B' },
  { label: 'Source', to: GITHUB, colour: '#FFD500' },
] as const

// Phones get 44 px tiles (three to a row under 400 px, so "Settings" fits);
// from 640 px they shrink to pills, unless the screen is a touch screen.
const TILE =
  'grid min-h-11 place-items-center rounded-xl px-1 text-center text-[0.8rem] font-bold leading-none text-[#10131A] shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)] transition duration-200 hover:-translate-y-1 hover:shadow-[inset_0_-3px_0_rgba(0,0,0,0.18),0_10px_20px_-8px_var(--tile)] focus-visible:-translate-y-1 min-[400px]:text-[0.74rem] sm:min-h-10 sm:min-w-[4.6rem] sm:rounded-2xl sm:px-3.5 sm:text-sm pointer-coarse:min-h-11'

export function SiteNav({ size = 44 }: { size?: number }) {
  return (
    <nav aria-label="Main" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
      <Logo size={size} />
      <ul className="grid w-full grid-cols-3 gap-1.5 min-[400px]:grid-cols-6 sm:flex sm:w-auto sm:gap-2">
        {TILES.map((t) => {
          const style = { background: t.colour, '--tile': t.colour } as React.CSSProperties
          return (
            <li key={t.label} className="contents">
              {t.to.startsWith('http') ? (
                <a href={t.to} target="_blank" rel="noreferrer" className={TILE} style={style}>
                  {t.label}
                </a>
              ) : (
                <NavLink to={t.to} className={({ isActive }) => `${TILE} ${isActive ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-[#16171B]' : ''}`} style={style}>
                  {t.label}
                </NavLink>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** The six colours as a thin strip: a cube's edge, used to close a page. */
export function ColourStrip() {
  return (
    <div aria-hidden className="grid grid-cols-6 gap-1.5">
      {TILES.map((t) => (
        <span key={t.label} className="h-2 rounded-full" style={{ background: t.colour }} />
      ))}
    </div>
  )
}
