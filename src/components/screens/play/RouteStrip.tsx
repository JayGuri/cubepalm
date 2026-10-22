import { useLayoutEffect, useRef } from 'react'
import { MoveChip, type MoveChipSize } from '../../cube/MoveChip'
import { CLICK_EASING, TURN_EASING } from '../../../motion/easing'
import { prefersReducedMotion } from '../../../motion/stagger'

// A window onto a route of moves: the one just made, the one to make now (the
// yellow sticker) and the next few, fading with distance. When the route moves
// on, every chip slides along one place, the way a layer turns one notch and
// settles; when the route itself changes (a shorter one was found, or a stray
// turn is being undone) its chips turn over into place instead. Drawing only:
// the words for the move are given beside it, so screen readers skip it.

const SLOT: Record<MoveChipSize, string> = { sm: 'w-10', md: 'w-12', lg: 'w-14' }
// By place in the window: the move just made, the current one, then the next ones fading out.
const FADE = ['opacity-60', 'opacity-100', 'opacity-100', 'opacity-60', 'opacity-35']

export function RouteStrip({
  moves,
  index,
  after = 3,
  size = 'md',
  trim = [],
  className = '',
}: {
  moves: string[]
  /** The move to make now; everything before it is done. */
  index: number
  /** How many moves to show past the current one. */
  after?: number
  size?: MoveChipSize
  /** Classes for the slots past the current one, in order: to drop the far ones on a narrow stage. */
  trim?: string[]
  className?: string
}) {
  const route = moves.join(' ')
  const list = useRef<HTMLOListElement>(null)
  const seen = useRef<{ route: string; index: number; left: Map<string, number> } | null>(null)

  useLayoutEffect(() => {
    const items = [...(list.current?.children ?? [])] as HTMLElement[]
    const left = new Map(items.map((li) => [li.dataset.key!, li.offsetLeft]))
    const before = seen.current
    seen.current = { route, index, left }
    if (!before || prefersReducedMotion() || typeof list.current?.animate !== 'function') return
    if (before.route !== route) {
      for (const li of items) {
        const away = Math.abs(Number(li.dataset.at) - index)
        li.animate([{ transform: 'perspective(160px) rotateX(-90deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], {
          duration: 380,
          delay: away * 45,
          easing: CLICK_EASING,
          fill: 'backwards',
        })
      }
      return
    }
    if (before.index === index) return
    for (const li of items) {
      const was = before.left.get(li.dataset.key!)
      if (was === undefined) li.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out', fill: 'backwards' })
      else if (was !== li.offsetLeft) li.animate([{ transform: `translateX(${was - li.offsetLeft}px)` }, { transform: 'none' }], { duration: 340, easing: TURN_EASING })
    }
  }, [route, index])

  const slots: number[] = []
  for (let at = index - 1; at <= index + after; at++) slots.push(at)
  return (
    <ol ref={list} aria-hidden className={`relative flex shrink-0 items-center gap-1 ${className}`}>
      {slots.map((at) => {
        const move = moves[at]
        const key = move === undefined ? `pad${at}` : String(at)
        return (
          <li key={key} data-key={key} data-at={at} className={`grid shrink-0 place-items-center transition-opacity duration-300 ${SLOT[size]} ${FADE[at - index + 1] ?? 'opacity-35'} ${trim[at - index - 1] ?? ''}`}>
            {move !== undefined && <MoveChip move={move} size={size} state={at < index ? 'done' : at === index ? 'current' : 'next'} />}
          </li>
        )
      })}
    </ol>
  )
}
