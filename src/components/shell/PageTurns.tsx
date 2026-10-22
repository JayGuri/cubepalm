import { useEffect, useLayoutEffect } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { prefersReducedMotion } from '../../motion/stagger'
import { PLACES, placeOf } from './places'

// Moving to another page turns the cube to another face: the page you leave
// turns away and the new one turns in and settles, with the View Transitions
// API. React Router only does that in data mode, so here a click on any of its
// links (they carry data-discover) is caught on its way down, the new page's
// code is fetched first (so the turn never shows a loading screen), and the
// router is told to go inside the transition. Everything else is left alone:
// modifier keys, new tabs, downloads, other sites, links within the page, the
// back and forward buttons, reduced motion, and browsers without the API.

/** Fetches the code of the page at a path, if it has any to fetch. */
export type Preload = (path: string) => Promise<unknown> | undefined

// Resolves the running turn once the new page has been drawn.
let landed: (() => void) | null = null

// Faces in order round the cube: going to a later one turns the cube left.
const rank = (path: string) => {
  const place = placeOf(path)
  return place ? PLACES.indexOf(place) + 1 : path === '/' ? 0 : PLACES.length
}

const wait = (ms: number) => new Promise<false>((resolve) => setTimeout(() => resolve(false), ms))

export function PageTurns({ preload }: { preload: Preload }) {
  const navigate = useNavigate()
  const location = useLocation()
  const type = useNavigationType()

  // A new page starts at its top, with focus on its heading so a screen reader
  // says where you are. (Back and forward keep what the browser restores.)
  useLayoutEffect(() => {
    if (type !== 'POP') {
      const target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null
      if (target) target.scrollIntoView()
      else window.scrollTo(0, 0)
      const heading = [...document.querySelectorAll<HTMLElement>('main h1')].find((h) => h.getClientRects().length > 0) ?? document.querySelector<HTMLElement>('main')
      if (heading) {
        if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
        heading.focus({ preventScroll: true })
      }
    }
    landed?.()
    landed = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

  useEffect(() => {
    const turn = async (to: string, from: string) => {
      const path = new URL(to, window.location.href).pathname
      // A page whose code is not here within a moment opens without the turn.
      const ready = await Promise.race([Promise.resolve(preload(path)).then(() => true, () => false), wait(300)])
      if (!ready || !document.startViewTransition) return navigate(to)
      const root = document.documentElement
      root.style.setProperty('--turn', rank(path) >= rank(from) ? '1' : '-1')
      root.dataset.turn = ''
      const t = document.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            landed = resolve
            void navigate(to)
            // Never hold the screen still for long, whatever happens.
            setTimeout(resolve, 1000)
          }),
      )
      t.ready.catch(() => undefined)
      const done = () => delete root.dataset.turn
      t.finished.then(done, done)
    }

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href][data-discover]')
      if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== '_self') || a.hasAttribute('download') || a.origin !== window.location.origin) return
      const { pathname, search } = window.location
      if (a.pathname === pathname && a.search === search) return
      if (!document.startViewTransition || prefersReducedMotion() || document.visibilityState !== 'visible') return
      // The router's own handler sees the click already taken and stands back.
      e.preventDefault()
      void turn(a.pathname + a.search + a.hash, pathname)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [navigate, preload])

  return null
}
