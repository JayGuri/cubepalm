import { BUTTON, PRIMARY } from './buttonStyles'
import { formatTime, type BestResult } from './useSolveSession'

/** The bar along the bottom of free play: the actions, and how the attempt is going. */
export function PlayActions({
  busy,
  solved,
  guideActive,
  solveActive,
  canUndo,
  scrambleLength,
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
  scrambleLength: number | null
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
  return (
    <footer className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-white/[0.07] px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
      <button type="button" className={PRIMARY} onClick={onScramble} disabled={busy}>
        Scramble
      </button>
      <button type="button" className={BUTTON} onClick={onUndo} disabled={busy || !canUndo}>
        Undo
      </button>
      <button type="button" className={BUTTON} onClick={onReset} disabled={busy}>
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
          <span
            className="text-[#9C9AA3]"
            data-testid="scramble-length"
            title="Turns used to scramble the cube, counted the same way as your moves: a half turn counts two"
          >
            Scramble: {scrambleLength}
          </span>
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
          <span data-testid="solve-summary" className={assisted ? 'text-[#9C9AA3]' : 'font-semibold text-[#FFD500]'}>
            {assisted ? 'with help' : newBest ? 'New best!' : best ? `Best ${formatTime(best.timeMs)}` : ''}
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
          Guide me
        </button>
      )}
      <button type="button" className={BUTTON} title="Plays the whole solution for you" onClick={onSolve} disabled={busy || solved || solveActive}>
        Solve for me
      </button>
    </footer>
  )
}
