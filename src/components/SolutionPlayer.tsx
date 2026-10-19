import { useState } from 'react'
import { PANEL_BUTTON } from './screens/play/buttonStyles'

// Plays a finished solution back: play, pause, step either way, change speed,
// and see every move. It sits where the guide strip does (the play screen
// places both), in the same line of sight as the cube.

export type PlaybackSpeed = 1 | 2 | 4

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

// Round icon buttons; the play button is the filled one.
const ICON =
  'grid h-9 w-9 shrink-0 place-items-center rounded-full transition not-disabled:active:scale-90 disabled:opacity-30 pointer-coarse:h-11 pointer-coarse:w-11'
const STEP = `${ICON} text-[#ECEAE4] not-disabled:hover:bg-white/10`
const PLAY = `${ICON} bg-[#FFD500] text-[#16171B] not-disabled:hover:bg-[#FFE04D]`

/** "R'" as it is printed in the move list: with a real prime mark. */
const prime = (move: string) => move.replace("'", '′')

export function SolutionPlayer({ status, moves, index, playing, speed, steps, optimal = false, onPlayPause, onStep, onSpeed, onClose, className = '' }: Props) {
  const [showMoves, setShowMoves] = useState(false)
  const finished = index >= moves.length && moves.length > 0

  return (
    <div data-testid="solution-player" className={`pointer-events-auto transition duration-200 starting:translate-y-1 starting:opacity-0 ${className}`}>
      {/* Wraps onto a second line (speed, Stop) where the stage is narrow. */}
      <div className="relative flex flex-wrap items-center gap-1 rounded-2xl border border-white/10 bg-[#202227]/90 py-1.5 pl-2 pr-1.5 text-sm text-[#B2B0B9] shadow-lg backdrop-blur">
        {status === 'solving' ? (
          <span data-testid="solution-finding" className="flex min-h-9 flex-1 items-center gap-3 px-2">
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-[#FFD500]" aria-hidden />
            Finding a short solution…
          </span>
        ) : (
          <>
            <button type="button" aria-label="Previous move" className={STEP} onClick={() => onStep(-1)} disabled={playing || index === 0}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M10 2 4 7l6 5V2Z" fill="currentColor" /></svg>
            </button>
            <button
              type="button"
              data-testid="solution-play"
              aria-label={playing ? 'Pause' : finished ? 'Done' : 'Play'}
              className={PLAY}
              onClick={onPlayPause}
              disabled={finished}
            >
              {playing ? (
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M3 2h3v10H3zM8 2h3v10H8z" fill="currentColor" /></svg>
              ) : finished ? (
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="m2.5 7.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M4 2l8 5-8 5V2Z" fill="currentColor" /></svg>
              )}
            </button>
            <button type="button" aria-label="Next move" className={STEP} onClick={() => onStep(1)} disabled={playing || finished}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="m4 2 6 5-6 5V2Z" fill="currentColor" /></svg>
            </button>

            <button
              type="button"
              data-testid="solution-moves-toggle"
              onClick={() => setShowMoves((v) => !v)}
              aria-expanded={showMoves}
              className="mx-1 flex min-w-[7.5rem] flex-1 flex-col justify-center rounded-lg px-2 py-0.5 text-left leading-tight transition hover:bg-white/5 pointer-coarse:min-h-11"
            >
              <span className={finished ? 'font-semibold text-[#4ED48A]' : 'text-[#ECEAE4]'} data-testid="solution-progress">
                {finished ? 'Solved' : `Move ${Math.min(index + 1, moves.length)} of ${moves.length}`}
              </span>
              <span className="text-xs">
                {steps} steps{optimal ? ', shortest possible' : ''} · <span className="underline decoration-white/25 underline-offset-2">{showMoves ? 'hide' : 'show'} moves</span>
              </span>
            </button>

            <div role="group" aria-label="Speed" className="flex rounded-full bg-black/25 p-0.5 text-xs">
              {([1, 2, 4] as PlaybackSpeed[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={speed === s}
                  onClick={() => onSpeed(s)}
                  className={`min-h-8 rounded-full px-2.5 transition pointer-coarse:min-h-11 pointer-coarse:min-w-11 ${speed === s ? 'bg-white/15 font-semibold text-[#ECEAE4]' : 'hover:text-[#ECEAE4]'}`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </>
        )}

        <button type="button" data-testid="solution-close" onClick={onClose} className={`${PANEL_BUTTON} ml-auto`}>
          {finished ? 'Close' : 'Stop'}
        </button>
        {status === 'ready' && (
          <span className="absolute inset-x-4 bottom-0 h-0.5 overflow-hidden rounded-full bg-white/10">
            <span className="block h-full bg-[#FFD500] transition-[width] duration-300" style={{ width: `${(index / Math.max(1, moves.length)) * 100}%` }} />
          </span>
        )}
      </div>

      {showMoves && status === 'ready' && (
        <ol data-testid="solution-moves" className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-2xl border border-white/10 bg-[#202227]/95 p-3 font-mono text-sm shadow-lg backdrop-blur">
          {moves.map((m, i) => (
            <li
              key={i}
              aria-current={i === index ? 'step' : undefined}
              className={`rounded-md px-2 py-0.5 transition-colors ${i < index ? 'text-[#8A8892]' : i === index ? 'bg-[#FFD500] font-semibold text-[#16171B]' : 'bg-white/5 text-[#ECEAE4]'}`}
            >
              {prime(m)}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
