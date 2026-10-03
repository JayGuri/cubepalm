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
  { label: 'Maths', to: `${GITHUB}/blob/main/docs/MATH.md`, colour: '#E5384F' },
  { label: 'Source', to: GITHUB, colour: '#FFD500' },
] as const

const TILE =
  'grid place-items-center rounded-xl px-1 py-2 text-center text-[0.72rem] font-bold leading-none text-[#10131A] shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)] transition duration-200 hover:-translate-y-1 hover:shadow-[inset_0_-3px_0_rgba(0,0,0,0.18),0_10px_20px_-8px_var(--tile)] focus-visible:-translate-y-1 sm:min-w-[4.6rem] sm:rounded-2xl sm:px-3.5 sm:py-2.5 sm:text-sm'

export function SiteNav({ size = 44 }: { size?: number }) {
  return (
    <nav aria-label="Main" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
      <Logo size={size} />
      <ul className="grid w-full grid-cols-6 gap-1.5 sm:flex sm:w-auto sm:gap-2">
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
