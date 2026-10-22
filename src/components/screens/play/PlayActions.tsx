import { useState } from 'react'
import { BUTTON, PRIMARY, PRIMARY_FILL, WELL } from './buttonStyles'
import { FaceGlyph } from './FaceGlyph'
import { formatTime, type BestResult } from './useSolveSession'

/** The bar along the bottom of free play: the actions, and how the attempt is going. */
export function PlayActions({
  busy,
  solved,
  guideActive,
  solveActive,
  canUndo,
  solverDown,
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
  face,
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
  /** The solver could not start: a random scramble, the guide and Solve for me all need it. */
  solverDown: boolean
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
  /** The status face: the place's colour, and what a scrambled face of this puzzle looks like. */
  face: { colour: string; mixed?: readonly string[] }
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
  const divider = <span aria-hidden className="h-4 w-px shrink-0 bg-white/10" />
  return (
    <footer className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 bg-panel px-3 py-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] sm:px-6 sm:py-3 [@media(max-height:30rem)]:py-2">
      {/* Starting the attempt over: a new scramble, or back to this one. */}
      <div className="grid w-full grid-cols-[2fr_1fr_1fr] gap-1.5 sm:flex sm:w-auto sm:gap-2">
        {/* One control in two halves, two stickers on one strip of plastic: a random scramble, or one you choose. */}
        <div className="flex gap-1 rounded-lg bg-plastic">
          <button type="button" className={`${PRIMARY} min-w-0 flex-1`} onClick={onScramble} disabled={busy || solverDown}>
            Scramble
          </button>
          <button
            type="button"
            data-testid="custom-scramble"
            aria-label="Choose a scramble"
            title="Type or tap in a scramble of your own"
            className={`${PRIMARY_FILL} w-9 shrink-0 pointer-coarse:w-11 sm:w-10`}
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
      </div>

      {/* How the attempt is going, in a window in the plastic: above the buttons on a narrow screen, between them on a wide one. */}
      <div className="order-first flex w-full justify-center md:order-none md:w-auto md:min-w-0 md:flex-1">
        <div className={`flex min-h-10 max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-lg px-3 py-1 text-xs sm:text-sm ${WELL}`}>
          <span data-testid="solved-status" aria-live="polite" className={`flex items-center gap-2 font-semibold ${solved ? 'text-fg' : 'text-fg-muted'}`}>
            <FaceGlyph mode={busy ? 'thinking' : solved ? 'solved' : 'scrambled'} colour={face.colour} mixed={face.mixed} />
            {solved ? 'Solved' : 'Scrambled'}
          </span>
          {scrambleLength !== null && (
            <>
              {divider}
              <button
                type="button"
                className="rounded text-fg-faint underline decoration-white/20 decoration-dotted underline-offset-4 hover:text-fg pointer-coarse:min-h-11"
                data-testid="scramble-length"
                title={`${scrambleText}

Click to copy. Turns are counted the same way as your moves: a half turn counts two.`}
                onClick={copyScramble}
              >
                {copied ? 'Scramble copied' : `Scramble: ${scrambleLength}`}
              </button>
            </>
          )}
          {divider}
          <span className="tabular-nums text-fg-faint" data-testid="move-count" title="Turns since the scramble; a half turn counts two">
            <span className="font-semibold text-fg">{moveCount}</span> {moveCount === 1 ? 'move' : 'moves'}
          </span>
          {timer.start !== null && (
            <span className="font-display font-bold tabular-nums text-fg" data-testid="solve-timer">
              {formatTime(elapsed)}
            </span>
          )}
          {timer.end !== null && (
            <span data-testid="solve-summary" className={assisted || !ranked ? 'text-fg-faint' : 'font-semibold text-sticker-yellow'}>
              {assisted ? 'with help' : !ranked ? 'your own scramble' : newBest ? 'New best' : best ? `Best ${formatTime(best.timeMs)}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Help. Both stay in place (flat when they have nothing to do) so the bar never shifts. */}
      <div className="grid w-full grid-cols-2 gap-1.5 sm:ml-auto sm:flex sm:w-auto sm:gap-2 md:ml-0">
        <button
          type="button"
          data-testid="guide-me"
          aria-label="Guide me"
          title={guideActive ? 'The guide is showing' : 'Shows the next move to make, one step at a time'}
          className={BUTTON}
          onClick={onGuide}
          disabled={busy || solverDown || solved || guideActive}
        >
          {/* The same arrow the guide draws on the cube. */}
          <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden className="shrink-0 text-sticker-yellow max-[22rem]:hidden">
            <path d="M2.4 6A3.6 3.6 0 0 1 9.4 4.4M9.8 2.2v2.4H7.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <Label full="Guide me" short="Guide" />
        </button>
        <button
          type="button"
          aria-label="Solve for me"
          className={BUTTON}
          title="Plays the whole solution for you"
          onClick={onSolve}
          disabled={busy || solved || solveActive || solverDown}
        >
          <Label full="Solve for me" short="Solve" />
        </button>
      </div>
    </footer>
  )
}

/** The full label, except on a mid-width screen, where the bar has to share its one row with the status. */
function Label({ full, short }: { full: string; short: string }) {
  return (
    <>
      <span className="md:max-lg:hidden">{full}</span>
      <span className="hidden md:max-lg:inline">{short}</span>
    </>
  )
}
