import type { CSSProperties } from 'react'
import type { Handedness } from '../../core/gestures/landmarks'
import { HAND_COLOR } from '../../core/gestures/signGestures'
import { FINGER_NAMES } from './fingers'

// A hand as you see your own when you hold it up to a screen: from behind,
// fingers up. A sign is its four fingers, each up or down; the thumb does not
// count. The right hand has its index finger on the left, the left hand on
// the right, so both index fingers face the middle.

// Raised length of each finger, in finger widths.
const LENGTH = [2.9, 3.3, 3.05, 2.35]
// The order the fingers appear in, left to right.
const ORDER: Record<Handedness, number[]> = { Right: [0, 1, 2, 3], Left: [3, 2, 1, 0] }

const colour = (side: Handedness) => ({ '--hand': HAND_COLOR[side] }) as CSSProperties

export function Hand({
  side,
  raised,
  onToggle,
  className = '',
}: {
  side: Handedness
  raised: boolean[]
  /** Makes each finger a button that raises or folds it. */
  onToggle?: (finger: number) => void
  className?: string
}) {
  return (
    <div className={`hand ${className}`} data-side={side} style={colour(side)} aria-hidden={onToggle ? undefined : true}>
      <span className="hand-thumb" />
      <span className="hand-palm" />
      <div className="hand-fingers">
        {ORDER[side].map((f) => {
          const look = { className: 'hand-finger', 'data-up': raised[f] ? '1' : '0', style: { '--len': LENGTH[f] } as CSSProperties }
          return onToggle ? (
            <button
              key={f}
              type="button"
              {...look}
              // "pinky" in the test id, as it always was.
              data-testid={`finger-${f === 3 ? 'pinky' : FINGER_NAMES[f]}`}
              aria-pressed={raised[f]}
              aria-label={`${FINGER_NAMES[f][0].toUpperCase()}${FINGER_NAMES[f].slice(1)} finger`}
              onClick={() => onToggle(f)}
            />
          ) : (
            <span key={f} {...look} />
          )
        })}
      </div>
    </div>
  )
}

/** A sign drawn small: four bars, the raised ones in the hand's colour. */
export function SignGlyph({ pose, side }: { pose: string; side: Handedness }) {
  return (
    <span className="sign-glyph" style={colour(side)} aria-hidden>
      {ORDER[side].map((f) => (
        <i key={f} data-up={pose[f]} style={{ '--h': `${Math.round(LENGTH[f] * 5.4)}px` } as CSSProperties} />
      ))}
    </span>
  )
}
