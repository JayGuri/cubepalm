import { useEffect, useRef, useState } from 'react'
import { parseScramble, SCRAMBLE_FACES } from '../../../core/puzzles/scrambleText'
import { BUTTON, PRIMARY } from './buttonStyles'

/**
 * Setting up a scramble of your own, to practise one position again and again.
 * Type it or paste it, or build it with the buttons (every turn is one tap).
 * Whatever is in the box is checked as you go, so the Use button only ever
 * sets up a scramble that really is one.
 */
export function ScrambleDialog({
  initial,
  onUse,
  onRandom,
  onClose,
}: {
  /** What to start the box with: the scramble on the cube now, if any. */
  initial: string
  /** Set the cube up with these turns. An empty list means a solved cube. */
  onUse: (turns: string[]) => void
  /** A fresh random scramble, to edit or use as it is. */
  onRandom: () => Promise<string[]>
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState(initial)
  const { turns, error } = parseScramble(text)

  // A real modal dialog: the browser handles Escape, focus and the backdrop.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    inputRef.current?.select()
  }, [])

  const add = (turn: string) => setText((t) => (t.trim() ? `${t.trim()} ${turn}` : turn))
  const removeLast = () => setText((t) => t.trim().split(/\s+/).slice(0, -1).join(' '))

  return (
    <dialog
      ref={dialogRef}
      data-testid="scramble-dialog"
      aria-labelledby="scramble-dialog-title"
      onClose={onClose}
      // A click on the backdrop (the dialog element itself, outside its panel) closes it.
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
      className="m-auto w-[min(34rem,calc(100vw-1.5rem))] rounded-3xl border border-white/10 bg-[#1B1D22] p-0 text-[#ECEAE4] shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <form
        className="p-5 sm:p-7"
        onSubmit={(e) => {
          e.preventDefault()
          if (!error) onUse(turns)
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="scramble-dialog-title" className="font-display text-2xl font-extrabold tracking-tight">
              Choose a scramble
            </h2>
            <p className="mt-1 text-sm text-[#9C9AA3]">Type or paste one, or build it with the buttons. Starts from a solved cube.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 rounded-full px-2 text-2xl leading-none text-[#9C9AA3] hover:text-[#ECEAE4]">
            ×
          </button>
        </div>

        <textarea
          ref={inputRef}
          data-testid="scramble-input"
          aria-label="Scramble"
          aria-invalid={Boolean(error)}
          aria-describedby="scramble-dialog-status"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter uses the scramble; Shift+Enter is not needed in a one-line notation.
            if (e.key === 'Enter') {
              e.preventDefault()
              if (!error) onUse(turns)
            }
          }}
          rows={2}
          spellCheck={false}
          autoCapitalize="characters"
          autoCorrect="off"
          placeholder="R U2 F' L D2 B"
          className={`mt-5 w-full resize-none rounded-xl border bg-[#16171B] px-3.5 py-3 font-mono text-base leading-relaxed outline-none placeholder:text-[#5F5D66] focus:border-[#FFD500] ${error ? 'border-[#E5384F]' : 'border-white/10'}`}
        />
        <p id="scramble-dialog-status" data-testid="scramble-status" className={`mt-2 min-h-[1.25rem] text-sm ${error ? 'text-[#FF8A9A]' : 'text-[#9C9AA3]'}`}>
          {error ?? (turns.length === 0 ? 'Empty: a solved cube.' : `${turns.length} ${turns.length === 1 ? 'turn' : 'turns'}.`)}
        </p>

        {/* Every turn there is, one tap each: the face, the other way, the half turn. */}
        <div className="mt-4 grid grid-cols-6 gap-1.5" data-testid="scramble-keys">
          {(['', "'", '2'] as const).map((suffix) =>
            SCRAMBLE_FACES.map((face) => (
              <button
                key={face + suffix}
                type="button"
                onClick={() => add(face + suffix)}
                className="h-10 rounded-xl border border-white/10 bg-[#202227] font-mono text-sm font-semibold transition hover:border-white/30 active:scale-95"
              >
                {face}
                {suffix === "'" ? '′' : suffix}
              </button>
            )),
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <button type="button" className={BUTTON} onClick={removeLast} disabled={!text.trim()}>
            Remove last
          </button>
          <button type="button" className={BUTTON} onClick={() => setText('')} disabled={!text.trim()}>
            Clear
          </button>
          <button
            type="button"
            className={BUTTON}
            data-testid="scramble-random"
            onClick={() => void onRandom().then((random) => setText(random.join(' '))).catch(() => undefined)}
          >
            Fill with a random one
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
          <p className="max-w-[16rem] text-xs text-[#9C9AA3]">A scramble you choose is practice: it does not count toward your best time.</p>
          <div className="flex gap-2">
            <button type="button" className={BUTTON} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" data-testid="scramble-use" className={PRIMARY} disabled={Boolean(error)}>
              {turns.length === 0 && !error ? 'Use a solved cube' : 'Use this scramble'}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  )
}
