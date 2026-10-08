import { useState } from 'react'
import { BUTTON, PRIMARY } from './buttonStyles'
import { formatTime, type BestResult } from './useSolveSession'

/** The bar along the bottom of free play: the actions, and how the attempt is going. */
export function PlayActions({
  busy,
  solved,
  guideActive,
  solveActive,
  canUndo,
  canReset,
  ranked,
  onCustom,
  scrambleLength,
  scrambleText,
  moveCount,
  timer,
  elapsed,
  assisted,
  newBest,
  best,
  onScramble,
  onUndo,
  onReset,
  onGuide,
  onSolve,
}: {
  busy: boolean
  solved: boolean
  /** The guide is up, so "Guide me" is not offered. */
  guideActive: boolean
  /** A solution is being found or played, so "Solve for me" is not offered. */
  solveActive: boolean
  canUndo: boolean
  /** There are moves to drop: the cube is not already at its starting position. */
  canReset: boolean
  /** A random scramble (which can set a best time), not one the player chose. */
  ranked: boolean
  /** Open the dialog for choosing a scramble. */
  onCustom: () => void
  scrambleLength: number | null
  /** The scramble in notation, e.g. "R U2 F'"; copied when its length is clicked. */
  scrambleText: string
  moveCount: number
  timer: { start: number | null; end: number | null }
  elapsed: number
  assisted: boolean
  newBest: boolean
  best: BestResult | null
  onScramble: () => void
  onUndo: () => void
  onReset: () => void
  onGuide: () => void
  onSolve: () => void
}) {
  const [copied, setCopied] = useState(false)
  const copyScramble = () => {
    void navigator.clipboard
      ?.writeText(scrambleText)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1400)
      })
      .catch(() => undefined)
  }
  return (
    <footer className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-white/[0.07] px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
      {/* One control in two halves: a random scramble, or one you choose. */}
      <div className="flex">
        <button type="button" className={`${PRIMARY} rounded-r-none pr-3 sm:pr-4`} onClick={onScramble} disabled={busy}>
          Scramble
        </button>
        <button
          type="button"
          data-testid="custom-scramble"
          aria-label="Choose a scramble"
          title="Type or tap in a scramble of your own"
          className={`${PRIMARY} rounded-l-none border-l border-[#16171B]/25 px-2.5 sm:px-3`}
          onClick={onCustom}
          disabled={busy}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path d="M2 4.5 6 8.5l4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <button type="button" className={BUTTON} onClick={onUndo} disabled={busy || !canUndo} title="Take back your last turn (never the scramble itself)">
        Undo
      </button>
      <button
        type="button"
        className={BUTTON}
        onClick={onReset}
        disabled={busy || !canReset}
        title={scrambleLength === null ? 'Back to the solved cube' : 'Back to the scrambled cube you were given, to try again'}
      >
        Reset
      </button>

      <div className="order-first flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 pb-1 text-xs sm:order-none sm:mx-auto sm:w-auto sm:pb-0 sm:text-sm">
        <span
          data-testid="solved-status"
          className={`rounded-full px-3 py-1 font-semibold ${solved ? 'bg-[#2FB36B]/15 text-[#4ED48A]' : 'bg-white/5 text-[#9C9AA3]'}`}
        >
          {solved ? 'Solved' : 'Scrambled'}
        </span>
        {scrambleLength !== null && (
          <button
            type="button"
            className="text-[#9C9AA3] underline decoration-white/20 decoration-dotted underline-offset-4 hover:text-[#ECEAE4]"
            data-testid="scramble-length"
            title={`${scrambleText}\n\nClick to copy. Turns are counted the same way as your moves: a half turn counts two.`}
            onClick={copyScramble}
          >
            {copied ? 'Scramble copied' : `Scramble: ${scrambleLength}`}
          </button>
        )}
        <span className="tabular-nums text-[#ECEAE4]" data-testid="move-count" title="Turns since the scramble; a half turn counts two">
          {moveCount} moves
        </span>
        {timer.start !== null && (
          <span className="tabular-nums text-[#ECEAE4]" data-testid="solve-timer">
            {formatTime(elapsed)}
          </span>
        )}
        {timer.end !== null && (
          <span data-testid="solve-summary" className={assisted || !ranked ? 'text-[#9C9AA3]' : 'font-semibold text-[#FFD500]'}>
            {assisted ? 'with help' : !ranked ? 'your own scramble' : newBest ? 'New best!' : best ? `Best ${formatTime(best.timeMs)}` : ''}
          </span>
        )}
      </div>

      {!solved && !guideActive && (
        <button
          type="button"
          data-testid="guide-me"
          title="Shows the next move to make, one step at a time"
          className={`${BUTTON} border-[#F5B83D]/60 text-[#F5B83D] hover:border-[#F5B83D]`}
          onClick={onGuide}
          disabled={busy}
        >
          <span className="sm:hidden">Guide</span>
          <span className="max-sm:hidden">Guide me</span>
        </button>
      )}
      <button type="button" className={BUTTON} title="Plays the whole solution for you" onClick={onSolve} disabled={busy || solved || solveActive}>
        <span className="sm:hidden">Solve</span>
        <span className="max-sm:hidden">Solve for me</span>
      </button>
    </footer>
  )
}
