import { useEffect, useRef, useState } from 'react'
import { MoveChip, TurnGlyph } from '../../cube/MoveChip'
import { LAYER_NAME } from '../../../core/notation'
import { parseScramble, SCRAMBLE_FACES } from '../../../core/puzzles/scrambleText'
import { BUTTON, CLOSE, KEY_SURFACE, PRIMARY } from './buttonStyles'

const KINDS = [
  { suffix: '', shown: '', kind: 'clockwise' },
  { suffix: "'", shown: '′', kind: 'counter' },
  { suffix: '2', shown: '2', kind: 'double' },
] as const

/**
 * Setting up a scramble of your own, to practise one position again and again.
 * Type it or paste it, or build it with the keys (every turn is one tap).
 * Whatever is in the box is checked as you go and drawn as move chips, so the
 * Use button only ever sets up a scramble that really is one.
 */
export function ScrambleDialog({
  initial,
  onUse,
  onRandom,
  onClose,
  colours = null,
}: {
  /** What to start the box with: the scramble on the cube now, if any. */
  initial: string
  /** Set the cube up with these turns. An empty list means a solved cube. */
  onUse: (turns: string[]) => void
  /** A fresh random scramble, to edit or use as it is. */
  onRandom: () => Promise<string[]>
  onClose: () => void
  /** Each face's colour on a solved cube, to label the columns of keys; none for a puzzle without colours. */
  colours?: Record<string, string> | null
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState(initial)
  const { turns, error } = parseScramble(text)
  // Counted the way the play screen counts the scramble: a half turn is two.
  const quarters = turns.reduce((n, t) => n + (t.includes('2') ? 2 : 1), 0)

  // A real modal dialog: the browser handles Escape, focus and the backdrop.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    // With a mouse, straight into the box. On a touch screen that would throw
    // the keyboard over half the dialog, so focus stays on the dialog (on its
    // first button, where showModal put it) until the box is tapped.
    if (matchMedia('(pointer: fine)').matches) inputRef.current?.select()
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
      // It opens like a face of the cube turning towards you.
      className="m-auto max-h-[calc(100dvh-1.5rem)] w-[min(34rem,calc(100vw-1.5rem))] origin-bottom flex-col overflow-hidden rounded-2xl bg-panel p-0 text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_30px_60px_-20px_rgb(0_0_0/0.9)] ring-1 ring-white/8 transition-[opacity,transform] duration-[380ms] ease-turn open:flex backdrop:bg-ink/80 starting:opacity-0 starting:[transform:perspective(1200px)_rotateX(14deg)_translateY(8px)]"
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault()
          if (!error) onUse(turns)
        }}
      >
        {/* The body scrolls on a short screen; the buttons that finish stay in view below it. */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="scramble-dialog-title" className="font-display text-2xl font-extrabold tracking-tight">
                Choose a scramble
              </h2>
              <p className="mt-1 text-sm text-fg-faint">Type or paste one, or build it with the keys. Starts from a solved cube.</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className={`${CLOSE} -mr-2 -mt-2 text-2xl`}>
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
            className={`mt-5 w-full resize-none rounded-lg bg-plastic px-3.5 py-3 text-lg leading-relaxed tracking-wide shadow-[inset_0_1px_3px_rgb(0_0_0/0.6)] ring-1 transition-shadow placeholder:text-[#77757E] ${error ? 'ring-[#E5384F]' : 'ring-white/8'}`}
            // The focus ring turns red with the border while what is typed is not a scramble.
            style={error ? { outlineColor: '#E5384F' } : undefined}
          />

          {/* What the box says, as the moves will be drawn everywhere else: each new one clicks in. */}
          {turns.length > 0 && (
            <ol aria-hidden className="mt-3 flex max-h-[4.25rem] flex-wrap gap-1 overflow-y-auto">
              {turns.map((t, i) => (
                <li key={i} className="transition duration-300 ease-click starting:scale-75 starting:opacity-0">
                  <MoveChip move={t} size="sm" />
                </li>
              ))}
            </ol>
          )}
          <p id="scramble-dialog-status" data-testid="scramble-status" className={`mt-2 min-h-[1.25rem] text-sm ${error ? 'text-[#FF8A9A]' : 'text-fg-faint'}`}>
            {error ??
              (turns.length === 0
                ? 'Empty: a solved cube.'
                : quarters === turns.length
                  ? `${turns.length} ${turns.length === 1 ? 'turn' : 'turns'}.`
                  : `${quarters} turns (${turns.length} moves, a half turn counting two).`)}
          </p>

          {/* Every turn there is, one tap each: a column per face (headed by its colour), then the other way, then the half turn. */}
          <div className="mt-4 grid grid-cols-6 gap-1.5" data-testid="scramble-keys">
            {SCRAMBLE_FACES.map((face) => (
              <div key={face} aria-hidden className="flex flex-col items-center gap-1 pb-0.5 text-[0.7rem] text-fg-faint">
                {colours && (
                  <span className="grid size-3.5 place-items-center rounded-[4px] bg-plastic">
                    <span className="size-2.5 rounded-[2px]" style={{ background: colours[face] }} />
                  </span>
                )}
                {LAYER_NAME[face]}
              </div>
            ))}
            {KINDS.map(({ suffix, shown, kind }) =>
              SCRAMBLE_FACES.map((face) => (
                <button
                  key={face + suffix}
                  type="button"
                  aria-label={face + shown}
                  onClick={() => add(face + suffix)}
                  className={`flex h-10 items-center justify-center gap-0.5 rounded-lg font-display text-sm font-bold transition duration-200 ease-click select-none pointer-coarse:h-11 ${KEY_SURFACE}`}
                >
                  {face}
                  {shown}
                  <TurnGlyph kind={kind} size={9} className="opacity-55" />
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

          <p className="mt-5 text-xs text-fg-faint">A scramble you choose is practice: it does not count toward your best time.</p>
        </div>

        <div className="flex shrink-0 justify-end bg-raised/40 px-5 py-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] sm:px-7">
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
