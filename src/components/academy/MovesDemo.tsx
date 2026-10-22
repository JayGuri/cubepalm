import { useEffect, useRef, useState } from 'react'
import { invertMoves } from '../../core/academy/lessons'
import { sequenceWords, splitMoves } from '../../core/notation'
import { useReducedMotion } from '../../motion/stagger'
import type { CssCubeHandle } from '../CssCube'
import { MoveChip, type MoveChipState } from '../cube/MoveChip'
import { AcademyCube } from './GoalCube'

// A lesson's algorithm, shown before it is tried: its moves as chips and in
// words, and a small cube that plays it over and over from a position it
// solves, the chips lighting up as each turn is made. It only plays while it
// is on screen, can be paused, and with reduced motion waits to be asked and
// then steps through without turning.

interface Alg {
  name: string
  moves: string
}

/** Text with moves in [brackets] drawn as move chips (and read out in words). */
export function MoveText({ text }: { text: string }) {
  return text.split(/\[([^\]]+)\]/).map((part, i) =>
    i % 2 ? (
      <span key={i}>
        <span className="sr-only">{sequenceWords(part)}</span>
        <span aria-hidden className="mx-0.5 inline-flex translate-y-[-1px] gap-1 align-middle">
          {splitMoves(part).map((m, j) => (
            <MoveChip key={j} move={m} size="sm" />
          ))}
        </span>
      </span>
    ) : (
      part
    ),
  )
}

const PACE = 470

export function MovesDemo({ lessonId, algs, hint }: { lessonId: string; algs: Alg[]; hint: string }) {
  const reduced = useReducedMotion()
  const [which, setWhich] = useState(0)
  const [playing, setPlaying] = useState(!reduced)
  const [visible, setVisible] = useState(false)
  // Which move is being made: -1 before the first, moves.length after the last.
  const [at, setAt] = useState(-1)
  const box = useRef<HTMLDivElement>(null)
  const cube = useRef<CssCubeHandle>(null)
  const alg = algs[which]
  const moves = splitMoves(alg.moves)

  useEffect(() => {
    const el = box.current
    if (!el || typeof IntersectionObserver === 'undefined') return setVisible(true)
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!playing || !visible) return
    const list = splitMoves(alg.moves)
    const setup = invertMoves(alg.moves)
    let alive = true
    let timer = 0
    const wait = (ms: number) => new Promise<void>((r) => (timer = window.setTimeout(r, ms)))
    void (async () => {
      while (alive) {
        cube.current?.reset(setup)
        setAt(-1)
        await wait(900)
        for (let i = 0; i < list.length && alive; i++) {
          setAt(i)
          if (reduced) {
            // No turning: the cube simply shows where each move leaves it.
            cube.current?.reset(`${setup} ${list.slice(0, i + 1).join(' ')}`)
            await wait(PACE + 250)
          } else await cube.current?.turn(list[i])
        }
        if (!alive) return
        setAt(list.length)
        await wait(1900)
        // Reduced motion: once through, then wait to be asked again.
        if (reduced) return setPlaying(false)
      }
    })()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [playing, visible, alg.moves, reduced])

  const chip = (i: number): MoveChipState => (at < 0 ? 'idle' : i < at ? 'done' : i === at ? 'current' : 'idle')

  return (
    <section className="mt-6" aria-labelledby="moves-label">
      <h2 id="moves-label" className="text-sm font-semibold text-fg">
        The moves
      </h2>
      <p data-testid="lesson-algorithm" className="sr-only">
        {algs[0].moves}
      </p>
      {algs.length > 1 && (
        <div role="group" aria-label="Which one the cube shows" className="mt-2 flex gap-1.5">
          {algs.map((a, i) => (
            <button
              key={a.name}
              type="button"
              aria-pressed={which === i}
              onClick={() => setWhich(i)}
              className={`min-h-9 rounded-lg px-3 text-sm font-semibold transition-[background-color,color,transform] duration-200 ease-click active:translate-y-px pointer-coarse:min-h-11 ${
                which === i ? 'sticker bg-sticker-orange text-plastic' : 'bg-raised text-fg-muted hover:text-fg'
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}
      <div className="mt-2.5 flex gap-3 rounded-xl bg-ink p-3">
        <div className="flex shrink-0 flex-col items-center">
          <div ref={box} aria-hidden className="academy-demo grid size-26 place-items-center">
            <AcademyCube ref={cube} cubie={21} lessonId={lessonId} setup={invertMoves(alg.moves)} pace={PACE} />
          </div>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="mt-1 inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-fg-muted transition hover:text-fg pointer-coarse:min-h-11"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden fill="currentColor">
              {playing ? <path d="M1.5 1h2.4v8H1.5zM6.1 1h2.4v8H6.1z" /> : <path d="M2 1l7 4-7 4z" />}
            </svg>
            {playing ? 'Pause' : reduced ? 'Step through' : 'Play'}
          </button>
        </div>
        <div className="min-w-0 pt-1">
          <p className="font-display text-base font-bold leading-tight text-fg">{alg.name}</p>
          <ol aria-hidden className="mt-2 flex flex-wrap gap-1">
            {moves.map((m, i) => (
              <li key={i}>
                <MoveChip move={m} size="sm" state={chip(i)} />
              </li>
            ))}
          </ol>
          <p className="mt-2 text-sm leading-snug text-fg-muted">{sequenceWords(alg.moves)}</p>
        </div>
      </div>
      <p className="mt-2 text-sm leading-snug text-fg-faint">{hint}</p>
    </section>
  )
}
