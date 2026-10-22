import { useEffect, useRef, useState } from 'react'
import { moveWords } from '../../core/notation'
import { prefersReducedMotion } from '../../motion/stagger'
import type { CssCubeHandle } from '../CssCube'
import { MoveChip } from '../cube/MoveChip'
import { AcademyCube } from './GoalCube'

// "What do the letters mean?" Tap a letter and the small cube turns round to
// face you with that side, turns it clockwise, and turns it back: R and R’ are
// seen, not memorised. Held like the lessons' cube: yellow on top, blue in front.

const FACES = [
  { letter: 'R', name: 'Right', colour: '#f0566b', view: { x: -24, y: -52 } },
  { letter: 'U', name: 'Up', colour: '#ffd500', view: { x: -48, y: -34 } },
  { letter: 'F', name: 'Front', colour: '#5b8def', view: { x: -22, y: -16 } },
  { letter: 'L', name: 'Left', colour: '#ff8a00', view: { x: -24, y: 52 } },
  { letter: 'D', name: 'Down', colour: '#f4f5f8', view: { x: 46, y: -34 } },
  { letter: 'B', name: 'Back', colour: '#2fb36b', view: { x: -24, y: 150 } },
]
const HOME = { x: -26, y: -34 }

export function NotationPrimer() {
  const cube = useRef<CssCubeHandle>(null)
  const [view, setView] = useState(HOME)
  const [move, setMove] = useState<string | null>(null)
  const run = useRef(0)
  useEffect(() => () => void run.current++, [])

  const show = async (letter: string, faceView: { x: number; y: number }) => {
    const token = ++run.current
    const live = () => token === run.current
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const c = cube.current
    if (!c) return
    c.reset()
    setView(faceView)
    setMove(null)
    const reduced = prefersReducedMotion()
    await wait(reduced ? 100 : 480)
    for (const m of [letter, `${letter}'`]) {
      if (!live()) return
      setMove(m)
      if (reduced) {
        c.reset(m === letter ? letter : '')
        await wait(1100)
      } else {
        await c.turn(m)
        await wait(650)
      }
    }
    if (live()) setMove(null)
  }

  return (
    <div className="academy-primer">
      <div className="flex items-center gap-4">
        <div aria-hidden className="grid size-30 shrink-0 place-items-center">
          <AcademyCube ref={cube} cubie={27} pace={620} view={view} />
        </div>
        <div className="min-w-0" aria-live="polite">
          {move ? (
            <>
              <MoveChip move={move} size="lg" state="current" />
              <p className="mt-2 text-sm leading-snug text-fg">
                {moveWords(move)}: {move.endsWith("'") ? 'the same face, back the other way.' : 'a quarter turn clockwise, as you look at that face.'}
              </p>
            </>
          ) : (
            <p className="text-sm leading-snug text-fg-muted">Tap a letter to see its face turn one way, then back.</p>
          )}
        </div>
      </div>
      <div role="group" aria-label="Turn a face" className="mt-4 grid grid-cols-6 gap-1.5">
        {FACES.map((f) => (
          <button
            key={f.letter}
            type="button"
            onClick={() => void show(f.letter, f.view)}
            aria-label={`${f.letter}: ${f.name}`}
            className="sticker flex min-h-12 flex-col items-center justify-center rounded-lg text-plastic transition-transform duration-200 ease-click active:translate-y-0.5"
            style={{ background: f.colour }}
          >
            <span className="font-display text-lg font-extrabold leading-none">{f.letter}</span>
            <span className="mt-0.5 text-[10px] font-bold leading-none">{f.name}</span>
          </button>
        ))}
      </div>
      <ul className="mt-4 space-y-1.5 text-sm leading-snug text-fg-muted">
        <li>
          <b className="text-fg">A letter</b> is a face: R right, L left, U up (the top), D down (the bottom), F front, B back. On its own it means a quarter turn
          clockwise, as if you were looking straight at that face.
        </li>
        <li>
          <b className="text-fg">’ after it</b> means turn it back the other way. <b className="text-fg">2</b> means turn it twice.
        </li>
        <li>In the lessons the cube keeps yellow on top and blue in front, so the letters always name the same colours: R is the red face, F the blue one, U the yellow one.</li>
      </ul>
    </div>
  )
}

/** The way into the primer from any lesson: a button that opens it over the page. Escape closes it. */
export function PrimerButton({ className = '' }: { className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          dialog.current?.showModal()
        }}
        aria-haspopup="dialog"
        className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg bg-raised px-2.5 text-sm font-semibold text-fg-muted transition hover:text-fg active:translate-y-px pointer-coarse:min-h-11 ${className}`}
      >
        <span aria-hidden className="sticker grid size-5 place-items-center rounded-[4px] bg-sticker-red font-display text-xs font-extrabold text-plastic">
          R
        </span>
        <span className="md:hidden">Letters?</span>
        <span className="max-md:hidden">What do the letters mean?</span>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="primer-title"
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        className="academy-dialog m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl bg-panel p-0 text-fg backdrop:bg-black/65"
      >
        <div className="p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 id="primer-title" className="font-display text-xl font-bold">
              What the letters mean
            </h2>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="-mr-2 -mt-1.5 grid size-10 place-items-center rounded-lg text-xl text-fg-muted hover:bg-raised hover:text-fg pointer-coarse:size-11"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          {open && <NotationPrimer />}
        </div>
      </dialog>
    </>
  )
}
