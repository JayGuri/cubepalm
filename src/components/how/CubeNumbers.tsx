import { memo, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from '../../motion/stagger'
import { MoveChip } from '../cube/MoveChip'
import { CssCube, type CssCubeHandle, type Vec3 } from '../CssCube'
import { COUNT_FACTORS, cyclesOf, groupDigits, positionCount, repeatsUntilSolved, type FactorId } from './howMath'
import { QUIET, Section } from './ui'

const Cube = memo(CssCube)
const GREY = '#2A2C33'
const isCorner = (h: Vec3) => h.every((v) => v !== 0)
const isEdge = (h: Vec3) => h.filter((v) => v !== 0).length === 2

// Which stickers each factor is about. A corner's twist is read from its
// top or bottom sticker; an edge's flip from its top or bottom sticker, or its
// front or back one in the middle layer (the solver's own convention).
const PAINT: Record<FactorId, (home: Vec3, normal: Vec3, colour: string) => string | null> = {
  corners: (h, _n, c) => (isCorner(h) ? c : GREY),
  twists: (h, n, c) => (isCorner(h) && n[1] !== 0 ? c : GREY),
  edges: (h, _n, c) => (isEdge(h) ? c : GREY),
  flips: (h, n, c) => (isEdge(h) && (h[1] !== 0 ? n[1] !== 0 : n[2] !== 0) ? c : GREY),
  parity: (h, _n, c) => (isCorner(h) || isEdge(h) ? c : GREY),
}

const N = positionCount()
const ALL = COUNT_FACTORS.slice(0, 4).reduce((p, f) => p * f.value, 1n) * 3n * 2n // every twist and flip drawn freely
const TRIGGER = ["R", "U", "R'", "U'"]
const TRIGGER_ROWS = repeatsUntilSolved(TRIGGER.join(' '))
const R_CYCLES = cyclesOf('R')
const T_CYCLES = cyclesOf(TRIGGER.join(' '))

function Cycle({ slots }: { slots: string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {[...slots, slots[0]].map((s, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && <span aria-hidden className="text-fg-faint">→</span>}
          <span className="rounded-md bg-raised px-1.5 py-0.5 font-bold text-fg">{s}</span>
        </span>
      ))}
    </span>
  )
}

function Count() {
  const [factor, setFactor] = useState<FactorId>('corners')
  const chosen = COUNT_FACTORS.find((f) => f.id === factor)!
  return (
    <div className="how-panel plastic mt-8 grid gap-6 rounded-2xl p-4 sm:p-6 md:grid-cols-[1fr_15rem] md:items-center">
      <div className="min-w-0">
        <p className="text-sm text-fg-muted">Positions a cube can reach by turning</p>
        <p className="how-hero-number mt-1 font-bold text-fg" data-testid="position-count">
          {groupDigits(N)}
        </p>
        <div role="group" aria-label="The factors of that number" className="mt-5 flex flex-wrap items-center gap-1.5">
          {COUNT_FACTORS.map((f, i) => (
            <span key={f.id} className="inline-flex items-center gap-1.5">
              {i > 0 && i < 4 && <span aria-hidden className="text-fg-faint">×</span>}
              <button
                type="button"
                aria-pressed={factor === f.id}
                onClick={() => setFactor(f.id)}
                className="how-factor min-h-11 min-w-11 rounded-xl px-3 font-bold"
              >
                {f.label}
              </button>
            </span>
          ))}
        </div>
        <p className="mt-4 min-h-[3lh] max-w-md text-fg-muted" aria-live="polite">
          <span className="font-bold text-fg">
            {chosen.label.replace('÷ ', '')} = {groupDigits(chosen.value)}
          </span>{' '}
          {chosen.says}.
        </p>
        <p className="mt-3 max-w-md text-sm text-fg-faint">
          Centres never move, so they are the fixed points everything else is measured against. Take a cube apart and put it back at random and it can land in{' '}
          {String(ALL / N)} times as many arrangements; only one in {String(ALL / N)} can be solved by turning.
        </p>
      </div>
      <div className="grid h-52 place-items-center" aria-hidden>
        <Cube cubie={40} stickerColour={PAINT[factor]} />
      </div>
    </div>
  )
}

function Turns() {
  const cube = useRef<CssCubeHandle>(null)
  const reduced = useReducedMotion()
  const [done, setDone] = useState(0) // finished repeats of the trigger
  const [step, setStep] = useState(-1) // the turn of the trigger playing now
  const busy = step >= 0
  const solvedAgain = done > 0 && done % TRIGGER_ROWS.length === 0

  const once = async () => {
    if (busy) return
    if (solvedAgain) {
      cube.current?.reset()
      setDone(0)
      return
    }
    const start = done
    if (reduced) {
      cube.current?.reset(Array(start + 1).fill(TRIGGER.join(' ')).join(' '))
    } else {
      for (let i = 0; i < TRIGGER.length; i++) {
        setStep(i)
        await cube.current?.turn(TRIGGER[i])
      }
    }
    setStep(-1)
    setDone(start + 1)
  }
  const rows = useMemo(() => TRIGGER_ROWS.map((r, i) => ({ ...r, shown: i < done })), [done])
  const max = Math.max(...TRIGGER_ROWS.map((r) => r.moved + r.turned))

  return (
    <div className="how-panel plastic mt-6 grid gap-6 rounded-2xl p-4 sm:p-6 md:grid-cols-[15rem_1fr] md:items-start">
      <div className="grid h-52 place-items-center md:h-60" aria-hidden>
        <Cube ref={cube} cubie={40} pace={260} />
      </div>
      <div className="min-w-0">
        <h3 className="font-display text-xl font-bold">A turn is a permutation</h3>
        <p className="mt-2 max-w-xl text-fg-muted">
          A turn does not change any piece, only where each one is. R carries four corners round one cycle and four edges round another:
        </p>
        <div className="mt-3 grid gap-2 text-sm" data-testid="r-cycles">
          {R_CYCLES.corners.map((c, i) => (
            <Cycle key={`c${i}`} slots={c} />
          ))}
          {R_CYCLES.edges.map((c, i) => (
            <Cycle key={`e${i}`} slots={c} />
          ))}
        </div>
        <p className="mt-5 max-w-xl text-fg-muted">
          Sequences are permutations too, and any one of them, repeated, comes back to where it started. Do R U R′ U′ and count how many times it takes.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5" aria-label="R U R′ U′" role="img">
            {TRIGGER.map((m, i) => (
              <MoveChip key={i} move={m} size="md" state={step === i ? 'current' : step > i ? 'done' : 'idle'} />
            ))}
          </div>
          <button type="button" className={QUIET} onClick={once} disabled={busy} data-testid="trigger-once">
            {solvedAgain ? 'Start again' : done === 0 ? 'Do it once' : 'Do it again'}
          </button>
        </div>
        <figure className="mt-5">
          <div className="flex items-end gap-1.5" role="img" aria-label={`Pieces away from home after each repeat: ${TRIGGER_ROWS.map((r) => r.moved + r.turned).join(', ')}.`}>
            {rows.map((r, i) => (
              <div key={i} className="flex w-11 flex-col items-center gap-1.5">
                <span className="text-xs tabular-nums text-fg-muted">{r.shown ? r.moved + r.turned : ''}</span>
                <div className="flex h-16 w-6 flex-col justify-end gap-0.5">
                  {r.shown && r.turned > 0 && <span className="how-bar-light rounded-t-[3px]" style={{ height: `${(r.turned / max) * 100}%` }} />}
                  {r.shown && r.moved > 0 && <span className={`how-bar ${r.turned ? '' : 'rounded-t-[3px]'}`} style={{ height: `${(r.moved / max) * 100}%` }} />}
                  {r.shown && r.moved + r.turned === 0 && <span className="how-solved-tick" />}
                  {!r.shown && <span className="h-full rounded-[3px] ring-1 ring-inset ring-white/10" />}
                </div>
                <span className="text-xs tabular-nums text-fg-faint">{i + 1}</span>
              </div>
            ))}
          </div>
          <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-faint">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="how-swatch how-bar" /> out of its slot
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="how-swatch how-bar-light" /> in its slot, but twisted or flipped
            </span>
          </figcaption>
        </figure>
        <p className="mt-4 max-w-xl text-sm text-fg-muted" aria-live="polite" data-testid="trigger-status">
          {solvedAgain
            ? `Solved again after ${TRIGGER_ROWS.length}. R U R′ U′ moves ${T_CYCLES.edges.map((c) => c.length).join(' and ')} edges round a cycle and swaps ${T_CYCLES.corners.length} pairs of corners, twisting them: the edges are home every 3 times, the corners are back in their slots every 2 but twisted until the 6th. Six is the first number that suits both.`
            : done === 0
              ? 'Pieces away from home after each time will appear here.'
              : `${done} done: ${TRIGGER_ROWS[done - 1].moved + TRIGGER_ROWS[done - 1].turned} pieces away from home.`}
        </p>
      </div>
    </div>
  )
}

export function CubeNumbers() {
  return (
    <Section
      id="numbers"
      title="A cube is a handful of numbers"
      lead={
        <p>
          To a program a cube is two lists: which piece sits in each slot, and how each one is turned. Counting the lists that turning can reach gives the number of positions,
          one factor for each thing you can see change.
        </p>
      }
    >
      <Count />
      <Turns />
    </Section>
  )
}
