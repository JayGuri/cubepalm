import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CLICK_EASING, SOFT_EASING } from '../../motion/easing'
import { prefersReducedMotion } from '../../motion/stagger'
import { PLACES, placeOf, type Place } from './places'

// The site's menu. The button is a face of nine stickers; pressed, four of them
// flip away and the rest turn into an X. What it opens is the cube itself,
// unfolded: the six places as a cross-shaped net, folding out from the front
// face and folding back up behind it when the menu closes.
//
// A modal <dialog> does the hard parts: the page behind is inert, Escape asks
// it to close, and the play screen's keyboard turns ignore keys pressed in it.

const ORDER: Place['face'][] = ['U', 'L', 'F', 'R', 'D', 'B']
const FACES = Object.fromEntries(PLACES.map((p) => [p.face, p])) as Record<Place['face'], Place>

// The nine stickers of the button as an X: edges gone, the rest turned into diamonds that touch.
const X = [
  'translate(2px, 2px) rotate(45deg)',
  'scale(0)',
  'translate(-2px, 2px) rotate(45deg)',
  'scale(0)',
  'rotate(45deg)',
  'scale(0)',
  'translate(2px, -2px) rotate(45deg)',
  'scale(0)',
  'translate(-2px, -2px) rotate(45deg)',
]

/** Nine stickers in a 3x3 face, or (as `x`) the X they make. */
function Glyph({ x = false }: { x?: boolean }) {
  return (
    <span aria-hidden className="menu-glyph">
      {X.map((t, i) => (
        <span key={i} style={x ? { transform: t } : undefined} />
      ))}
    </span>
  )
}

// The whole opening takes this long; every part of it ends together, so that
// playing it backwards is the closing, in reverse order: the last face out is
// the first one folded back, and the light comes back last.
const TOTAL = 480

function unfold(dialog: HTMLDialogElement): Animation[] {
  const out: Animation[] = []
  const play = (el: Element | null, frames: Keyframe[], delay: number, duration: number, easing = CLICK_EASING) => {
    if (el) out.push(el.animate(frames, { delay, duration, easing, endDelay: TOTAL - delay - duration, fill: 'both' }))
  }
  const face = (f: Place['face']) => dialog.querySelector<HTMLElement>(`[data-face="${f}"]`)
  // A side face starts folded back behind the front one, edge-on, and swings
  // out on the edge it shares with its neighbour.
  const fold = (f: Place['face'], origin: string, axis: 'X' | 'Y', angle: number, delay: number, duration = 240) => {
    const el = face(f)
    if (el) el.style.transformOrigin = origin
    play(el, [{ transform: `rotate${axis}(${angle}deg)`, opacity: 0 }, { transform: `rotate${axis}(0deg)`, opacity: 1 }], delay, duration)
  }

  play(dialog.querySelector('.menu-scrim'), [{ opacity: 0 }, { opacity: 1 }], 0, 220, SOFT_EASING)
  play(face('F'), [{ transform: 'scale(0.86)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], 0, 200)
  fold('U', '50% 100%', 'X', 90, 30)
  fold('R', '0% 50%', 'Y', 90, 55)
  fold('D', '50% 0%', 'X', -90, 80)
  fold('L', '100% 50%', 'Y', -90, 105)
  // The back face hangs off the right face on a wide screen and off the bottom one on a tall
  // screen, and unfolds once its neighbour has landed.
  if (matchMedia('(orientation: landscape)').matches) fold('B', '0% 50%', 'Y', 90, 235, 220)
  else fold('B', '50% 0%', 'X', -90, 260, 220)

  dialog.querySelectorAll('.menu-close .menu-glyph > span').forEach((el, i) => {
    const edge = i % 2 === 1
    play(el, [{ transform: edge ? 'scale(1)' : 'translate(0, 0) rotate(0deg)' }, { transform: X[i] }], edge ? 0 : 40, edge ? 150 : 220)
  })
  return out
}

function lockScroll(lock: boolean) {
  const root = document.documentElement
  // Keep the scrollbar's room, if there is a scrollbar, so the page does not shift sideways.
  const gutter = lock && window.innerWidth > root.clientWidth
  root.style.overflow = lock ? 'hidden' : ''
  root.style.scrollbarGutter = gutter ? 'stable' : ''
}

export function SiteMenu({ className = '' }: { className?: string }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const closer = useRef<HTMLButtonElement>(null)
  const motion = useRef<Animation[]>([])
  const closing = useRef(false)
  const { pathname } = useLocation()
  const here = placeOf(pathname)

  // The X sits exactly over the button it replaces.
  const placeCloser = () => {
    const r = trigger.current?.getBoundingClientRect()
    const x = closer.current
    if (!r || !x) return false
    Object.assign(x.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` })
    return r.width > 0
  }

  const finish = () => {
    closing.current = false
    motion.current.forEach((a) => a.cancel())
    motion.current = []
    if (dialog.current?.open) dialog.current.close()
    lockScroll(false)
    setOpen(false)
  }

  const show = () => {
    const d = dialog.current
    if (!d) return
    if (closing.current) {
      // Asked to open while folding up: unfold again from where it is.
      closing.current = false
      motion.current.forEach((a) => a.reverse())
      setOpen(true)
      return
    }
    if (d.open || !placeCloser()) return
    d.showModal()
    lockScroll(true)
    setOpen(true)
    // Focus starts on the face you are on (or the front one), so Tab and Escape work at once.
    ;(d.querySelector<HTMLElement>('a[aria-current="page"]') ?? d.querySelector<HTMLElement>('[data-face="F"] a'))?.focus()
    motion.current = prefersReducedMotion() ? [] : unfold(d)
  }

  const hide = () => {
    if (!dialog.current?.open || closing.current) return
    setOpen(false)
    const parts = motion.current
    if (!parts.length) return finish()
    closing.current = true
    parts.forEach((a) => {
      a.reverse()
      a.updatePlaybackRate(-1.7)
    })
    void Promise.all(parts.map((a) => a.finished)).then(() => closing.current && finish(), () => undefined)
  }

  // Leaving the page closes it at once; so does the button it covers going away (a phone turned on its side).
  useEffect(() => {
    if (!dialog.current?.open) return
    finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
  useEffect(() => {
    if (!open) return
    const onResize = () => void (placeCloser() || finish())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  useEffect(() => () => lockScroll(false), [])

  // Tab and Shift+Tab go round the menu, never out of it.
  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== 'Tab') return
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('a[href], button')]
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
  // A press anywhere but on a face or the X closes it.
  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (!(e.target as Element).closest('a, button')) hide()
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`menu-button ${className}`}
        aria-label="Menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={show}
      >
        <Glyph />
      </button>
      <dialog
        ref={dialog}
        id={id}
        aria-label="Menu"
        className="site-menu"
        onCancel={(e) => {
          e.preventDefault()
          hide()
        }}
        onClose={finish}
        onKeyDown={onKeyDown}
        onClick={onClick}
      >
        <div className="menu-scrim" />
        <button ref={closer} type="button" className="menu-button menu-close" aria-label="Close menu" onClick={() => (closing.current ? show() : hide())}>
          <Glyph x />
        </button>
        <ul className="cube-net">
          {ORDER.map((f) => {
            const p = FACES[f]
            const face = (
              <>
                <span aria-hidden className="net-stickers">
                  {X.map((_, i) => (
                    <span key={i} />
                  ))}
                </span>
                <span className="net-label">
                  {p.label}
                  {p.external && <span className="sr-only"> (opens in a new tab)</span>}
                </span>
              </>
            )
            const style = { '--face': p.colour } as CSSProperties
            return (
              <li key={f} data-face={f} style={{ gridArea: f }}>
                {p.external ? (
                  <a href={p.to} target="_blank" rel="noreferrer" className="net-face" style={style}>
                    {face}
                  </a>
                ) : (
                  <Link to={p.to} className="net-face" style={style} aria-current={p === here ? 'page' : undefined}>
                    {face}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      </dialog>
    </>
  )
}
