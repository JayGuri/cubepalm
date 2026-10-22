import type { CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Logo } from './Logo'
import { SiteMenu } from './shell/SiteMenu'
import { PLACES, placeOf } from './shell/places'

// The header of every content page. The six places are the cube's six faces,
// drawn as stickers on a strip of black plastic: the face you are on is lit,
// the others sit in shadow until you reach for one. On a phone there is no room
// for six, so it is the logo and the menu, which opens the whole cube.

export function SiteNav({ size = 44 }: { size?: number }) {
  const here = placeOf(useLocation().pathname)
  return (
    <nav aria-label="Main" className="flex items-center justify-between gap-4">
      <Logo size={size} />
      <ul className="face-row max-lg:hidden">
        {PLACES.map((p) => {
          const style = { '--face': p.colour } as CSSProperties
          return (
            <li key={p.label} className="contents">
              {p.external ? (
                <a href={p.to} target="_blank" rel="noreferrer" className="face-tab" style={style}>
                  {p.label}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                <Link to={p.to} className="face-tab" style={style} aria-current={p === here ? 'page' : undefined}>
                  {p.label}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
      <SiteMenu className="lg:hidden" />
    </nav>
  )
}

/** The six colours as a strip of stickers: a cube's edge. */
export function ColourStrip() {
  return (
    <div aria-hidden className="grid grid-cols-6 gap-2">
      {PLACES.map((p) => (
        <span key={p.label} className="sticker h-3 rounded-full transition duration-300 hover:-translate-y-1 hover:scale-y-125" style={{ background: p.colour }} />
      ))}
    </div>
  )
}
