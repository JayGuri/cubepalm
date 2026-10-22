import { useState } from 'react'
import { MoveChip } from './cube/MoveChip'
import { ICON_KEY, KEY_SURFACE, PANEL, PANEL_BUTTON, PRIMARY_FILL, STICKER } from './screens/play/buttonStyles'
import { FaceGlyph } from './screens/play/FaceGlyph'
import { RouteStrip } from './screens/play/RouteStrip'

// Plays a finished solution back: play, pause, step either way, change speed,
// and see every move. It sits where the guide strip does (the play screen
// places both), in the same line of sight as the cube.

export type PlaybackSpeed = 1 | 2 | 4
const SPEEDS: PlaybackSpeed[] = [1, 2, 4]

interface Props {
  status: 'solving' | 'ready'
  /** Each move as notation, e.g. "R", "U'", "F2". */
  moves: string[]
  /** How many moves have been played. */
  index: number
  playing: boolean
  speed: PlaybackSpeed
  /** Quarter turns: what a person actually has to do. */
  steps: number
  /** Provably the shortest solution there is. */
  optimal?: boolean
  onPlayPause: () => void
  onStep: (direction: 1 | -1) => void
  onSpeed: (speed: PlaybackSpeed) => void
  onClose: () => void
  /** Where it sits on the stage (the play screen decides). */
  className?: string
}

const STEP_KEY = `${ICON_KEY} ${KEY_SURFACE}`
const icon = (d: string, filled = true) => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
    <path d={d} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export function SolutionPlayer({ status, moves, index, playing, speed, steps, optimal = false, onPlayPause, onStep, onSpeed, onClose, className = '' }: Props) {
  const [showMoves, setShowMoves] = useState(false)
  const finished = index >= moves.length && moves.length > 0

  return (
    // Its own container: the breakpoints below read this panel's actual rendered width, not the
    // stage's (the two differ once the stage places the panel in a squeezed corner).
    <div data-testid="solution-player" className={`pointer-events-auto transition duration-300 ease-soft starting:translate-y-1 starting:opacity-0 ${className}`}>
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl p-2 text-sm text-fg-muted ${PANEL}`}>
        {status === 'solving' ? (
          <span data-testid="solution-finding" className="flex min-h-10 flex-1 items-center gap-3 pl-1.5">
            <FaceGlyph mode="thinking" colour={STICKER.yellow} />
            Finding a short solution…
          </span>
        ) : (
          <>
            {/* Three keys on one strip of plastic: back a move, play or pause, on a move. */}
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" aria-label="Previous move" className={STEP_KEY} onClick={() => onStep(-1)} disabled={playing || index === 0}>
                {icon('M3 2.5v9M11.5 2.5 5 7l6.5 4.5Z', false)}
              </button>
              <button
                type="button"
                data-testid="solution-play"
                aria-label={playing ? 'Pause' : finished ? 'Done' : 'Play'}
                className={`${PRIMARY_FILL} w-12 shrink-0 px-0`}
                onClick={onPlayPause}
                disabled={finished}
              >
                {playing ? icon('M3 2h3v10H3zM8 2h3v10H8z') : finished ? icon('m2.5 7.5 3 3 6-7', false) : icon('M4 2l8 5-8 5V2Z')}
              </button>
              <button type="button" aria-label="Next move" className={STEP_KEY} onClick={() => onStep(1)} disabled={playing || finished}>
                {icon('M11 2.5v9M2.5 2.5 9 7l-6.5 4.5Z', false)}
              </button>
            </div>

            {/* On a short landscape screen the panel's own width is squeezed well below the stage's,
                so the chip strip (a nice-to-have beside the status text) gives way first. */}
            <div className="[@media(max-height:30rem)]:hidden">
              <RouteStrip moves={moves} index={index} size="sm" trim={['', '@max-[24rem]:hidden', '@max-[40rem]:hidden']} />
            </div>
            {/* On a narrow stage the strip and the keys make the first line; the status its own
                full-width line next; speed and Stop share a last line, spread apart. */}
            <span aria-hidden className="hidden h-0 basis-full @max-[40rem]:block" />

            <button
              type="button"
              data-testid="solution-moves-toggle"
              onClick={() => setShowMoves((v) => !v)}
              aria-expanded={showMoves}
              className="-my-1 flex min-w-0 flex-1 basis-full flex-col justify-center gap-0.5 rounded-md px-1.5 py-1 text-left leading-tight transition hover:bg-white/5 pointer-coarse:min-h-11 @min-[40rem]:basis-auto"
            >
              <span className="flex items-center gap-1.5">
                <span className={`whitespace-nowrap ${finished ? 'font-semibold text-sticker-green' : 'text-fg'}`} data-testid="solution-progress">
                  {finished ? 'Solved' : `Move ${Math.min(index + 1, moves.length)} of ${moves.length}`}
                </span>
                <span className="flex items-center gap-0.5 text-xs underline decoration-white/25 underline-offset-2">
                  <span className="@max-[40rem]:hidden">{showMoves ? 'Hide moves' : 'All moves'}</span>
                  <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden className={`transition-transform duration-300 ease-turn ${showMoves ? 'rotate-180' : ''}`}>
                    <path d="M2 3.5 5 6.5l3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-x-1.5 text-xs [@media(max-height:30rem)]:hidden">
                <span className="whitespace-nowrap">{steps} steps</span>
                {optimal && (
                  <span className="flex items-center gap-1 whitespace-nowrap text-sticker-green">
                    <FaceGlyph mode="solved" colour={STICKER.green} sticker={3} />
                    shortest possible
                  </span>
                )}
              </span>
            </button>

            {/* Speed and Stop: their own line on a narrow stage, spread to the far edges. */}
            <div className="flex w-full basis-full items-center justify-between gap-2 @min-[40rem]:w-auto @min-[40rem]:basis-auto @min-[40rem]:justify-normal @min-[40rem]:contents">
              {/* The speed: a key slides under the one chosen. */}
              <div role="group" aria-label="Speed" className="relative grid shrink-0 grid-cols-3 rounded-lg bg-plastic p-0.5 text-xs">
                <span
                  aria-hidden
                  className="absolute inset-y-0.5 left-0.5 w-[calc((100%-4px)/3)] rounded-md bg-raised shadow-[inset_0_1px_0_rgb(255_255_255/0.08),inset_0_-2px_0_rgb(0_0_0/0.45)] transition-transform duration-300 ease-click"
                  style={{ transform: `translateX(${SPEEDS.indexOf(speed) * 100}%)` }}
                />
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={speed === s}
                    onClick={() => onSpeed(s)}
                    className={`relative min-h-8 min-w-9 rounded-md px-2 font-semibold tabular-nums transition-colors duration-200 pointer-coarse:min-h-11 pointer-coarse:min-w-11 ${speed === s ? 'text-fg' : 'text-fg-faint hover:text-fg'}`}
                  >
                    {s}×
                  </button>
                ))}
              </div>

              <button type="button" data-testid="solution-close" onClick={onClose} className={`${PANEL_BUTTON} @min-[40rem]:ml-auto`}>
                {finished ? 'Close' : 'Stop'}
              </button>
            </div>
          </>
        )}

        {status === 'solving' && (
          <button type="button" data-testid="solution-close" onClick={onClose} className={`${PANEL_BUTTON} ml-auto`}>
            Stop
          </button>
        )}
      </div>

      {showMoves && status === 'ready' && (
        <ol data-testid="solution-moves" className={`mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-xl p-2.5 ${PANEL}`}>
          {moves.map((m, i) => (
            <li key={i} aria-current={i === index ? 'step' : undefined}>
              <MoveChip move={m} size="sm" state={i < index ? 'done' : i === index ? 'current' : 'idle'} />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
