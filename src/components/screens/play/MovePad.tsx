import { useState } from 'react'
import { TurnGlyph } from '../../cube/MoveChip'
import { KEY_SURFACE, STICKER_SURFACE } from './buttonStyles'

const FACES = ['R', 'U', 'F', 'L', 'D', 'B'] as const

/**
 * Turn buttons for a screen with no keyboard. Dragging a small cube with a
 * thumb is fiddly and the keys R U F L D B do not exist on a phone, so the same
 * six turns sit in a row here, with one switch for the other direction. Each
 * key wears the colour of its face's centre, so the letters can be matched to
 * the cube without knowing the notation.
 */
export function MovePad({
  onTurn,
  disabled,
  hint = null,
  colours = null,
}: {
  onTurn: (notation: string) => void
  disabled: boolean
  /** The turn the guide is asking for (e.g. "B'"): its key turns yellow, and the direction switch follows it. */
  hint?: string | null
  /** Each face's centre colour as the cube shows it now; none for a puzzle whose faces have no colour. */
  colours?: Record<string, string> | null
}) {
  const [reverse, setReverse] = useState(false)
  // A new hint sets the direction switch to match (the player can still flip it).
  const [seenHint, setSeenHint] = useState(hint)
  if (hint !== seenHint) {
    setSeenHint(hint)
    if (hint) setReverse(hint.endsWith("'"))
  }
  const wanted = hint && hint.endsWith("'") === reverse ? hint[0] : null
  return (
    <div data-testid="move-pad" className="flex shrink-0 justify-center bg-panel px-3 py-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]">
      <div className="flex w-full max-w-lg items-center gap-1.5">
        {FACES.map((face) => (
          <button
            key={face}
            type="button"
            disabled={disabled}
            aria-label={`Turn the ${face} face ${reverse ? 'counter-clockwise' : 'clockwise'}`}
            onClick={() => onTurn(reverse ? `${face}'` : face)}
            data-wanted={wanted === face ? 'true' : undefined}
            className={`flex h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg transition duration-200 ease-click select-none disabled:cursor-not-allowed ${
              wanted === face ? `${STICKER_SURFACE} -translate-y-0.5` : KEY_SURFACE
            }`}
          >
            {colours && (
              // The centre's sticker, set in black plastic as it is on the cube.
              <span aria-hidden className="grid size-3.5 place-items-center rounded-[4px] bg-plastic">
                <span className="size-2.5 rounded-[2px]" style={{ background: colours[face] }} />
              </span>
            )}
            <span className="flex items-center gap-0.5 font-display text-[0.95rem] font-bold leading-none">
              {face}
              {reverse ? '’' : ''}
              <TurnGlyph kind={reverse ? 'counter' : 'clockwise'} size={9} className="opacity-60" />
            </span>
          </button>
        ))}
        <button
          type="button"
          aria-pressed={reverse}
          aria-label="Turn the other way"
          title="Turn the other way"
          onClick={() => setReverse((v) => !v)}
          className={`grid h-11 w-12 shrink-0 place-items-center rounded-lg transition duration-200 ease-click select-none ${
            reverse
              ? 'sticker translate-y-px bg-hand-left text-plastic'
              : `${KEY_SURFACE} text-fg-muted`
          }`}
        >
          <TurnGlyph kind="counter" size={18} />
        </button>
      </div>
    </div>
  )
}
