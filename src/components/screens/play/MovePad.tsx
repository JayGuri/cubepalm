import { useState } from 'react'

const FACES = ['R', 'U', 'F', 'L', 'D', 'B'] as const

/**
 * Turn buttons for a screen with no keyboard. Dragging a small cube with a
 * thumb is fiddly and the keys R U F L D B do not exist on a phone, so the same
 * six turns sit in a row here, with one switch for the other direction.
 */
export function MovePad({
  onTurn,
  disabled,
  hint = null,
}: {
  onTurn: (notation: string) => void
  disabled: boolean
  /** The turn the guide is asking for (e.g. "B'"): its button glows, and the direction switch follows it. */
  hint?: string | null
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
    <div data-testid="move-pad" className="flex shrink-0 items-center justify-center gap-1.5 border-t border-white/[0.07] px-3 py-2">
      {FACES.map((face) => (
        <button
          key={face}
          type="button"
          disabled={disabled}
          aria-label={`Turn the ${face} face ${reverse ? 'counter-clockwise' : 'clockwise'}`}
          onClick={() => onTurn(reverse ? `${face}'` : face)}
          data-wanted={wanted === face ? 'true' : undefined}
          className={`h-10 min-w-0 flex-1 rounded-xl border font-mono text-base font-semibold transition active:scale-95 disabled:opacity-40 ${
            wanted === face
              ? 'border-[#F5B83D] bg-[#F5B83D] text-[#16171B] shadow-[0_0_18px_-4px_#F5B83D]'
              : 'border-white/10 bg-[#202227] text-[#ECEAE4] active:bg-[#2C2F36]'
          }`}
        >
          {face}
          {reverse ? '′' : ''}
        </button>
      ))}
      <button
        type="button"
        aria-pressed={reverse}
        aria-label="Turn the other way"
        title="Turn the other way"
        onClick={() => setReverse((v) => !v)}
        className={`h-10 shrink-0 rounded-xl px-3 text-lg font-semibold transition ${reverse ? 'bg-[#4CC9F0] text-[#16171B]' : 'border border-white/10 bg-[#202227] text-[#9C9AA3]'}`}
      >
        ↺
      </button>
    </div>
  )
}
