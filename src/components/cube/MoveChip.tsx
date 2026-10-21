import { moveWords, parseTurn, type TurnKind } from '../../core/notation'

// One move of cube notation as a small sticker: the layer's letter, and a
// curved arrow in its corner for which way it turns. The same chip is used
// wherever a move is written (lessons, the guide, the solution player, the
// scramble box), so a learner sees one consistent picture of "R'".

export type MoveChipState = 'idle' | 'done' | 'current' | 'next'
export type MoveChipSize = 'sm' | 'md' | 'lg'

const SIZE: Record<MoveChipSize, string> = {
  sm: 'h-7 min-w-7 gap-0.5 rounded-md px-1.5 text-sm',
  md: 'h-9 min-w-9 gap-0.5 rounded-lg px-2 text-base',
  lg: 'h-12 min-w-12 gap-1 rounded-xl px-2.5 text-xl',
}
const GLYPH: Record<MoveChipSize, number> = { sm: 9, md: 11, lg: 14 }

const STATE: Record<MoveChipState, string> = {
  idle: 'bg-raised text-fg sticker',
  next: 'bg-raised text-fg ring-1 ring-inset ring-white/15',
  current: 'bg-sticker-yellow text-plastic sticker',
  done: 'bg-transparent text-fg-faint ring-1 ring-inset ring-white/10',
}

/** A quarter of a circle with an arrowhead: which way the layer turns. */
export function TurnGlyph({ kind, size = 11, className = '' }: { kind: TurnKind; size?: number; className?: string }) {
  // Drawn clockwise; the counter-clockwise one is its mirror image.
  const mirror = kind === 'counter' ? 'scale(-1 1) translate(-12 0)' : undefined
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden className={`shrink-0 ${className}`}>
      <g transform={mirror} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d={kind === 'double' ? 'M2.2 7.6A4.2 4.2 0 1 1 7.6 9.8' : 'M2.4 6A3.6 3.6 0 0 1 9.4 4.4'} />
        <path d={kind === 'double' ? 'M5.5 9.9h2.2v-2.2' : 'M9.8 2.2v2.4H7.4'} />
      </g>
    </svg>
  )
}

export function MoveChip({
  move,
  state = 'idle',
  size = 'md',
  className = '',
}: {
  move: string
  state?: MoveChipState
  size?: MoveChipSize
  className?: string
}) {
  const { layer, kind } = parseTurn(move)
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center font-display font-bold leading-none tabular-nums transition-[background-color,color,box-shadow,transform] duration-300 ease-click ${SIZE[size]} ${STATE[state]} ${
        state === 'current' ? '-translate-y-0.5' : ''
      } ${className}`}
      title={moveWords(move)}
      aria-label={moveWords(move)}
    >
      <span aria-hidden>
        {layer}
        {kind === 'counter' ? '’' : kind === 'double' ? '2' : ''}
      </span>
      <TurnGlyph kind={kind} size={GLYPH[size]} className={state === 'current' ? 'opacity-80' : 'opacity-60'} />
    </span>
  )
}
