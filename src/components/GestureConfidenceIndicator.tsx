import { useEffect, useState } from 'react'
import type { LandmarkFrame } from '../core/gestures/landmarks'
import type { GestureFeed } from '../core/gestures/useHandGestures'

// spec 4.4 / 10: a small live confidence readout so a user understands why a
// gesture wasn't recognized, and is prompted to improve lighting when jittery.

export interface GestureConfidenceIndicatorProps {
  feed: GestureFeed
}

type Level = 'none' | 'low' | 'ok' | 'good'

const levelOf = (frame: LandmarkFrame): Level => {
  if (frame.hands.length === 0) return 'none'
  const best = frame.hands.reduce((max, h) => Math.max(max, h.score), 0)
  return best < 0.5 ? 'low' : best < 0.8 ? 'ok' : 'good'
}

export function GestureConfidenceIndicator({ feed }: GestureConfidenceIndicatorProps) {
  // Re-renders only when the reading changes band, not on every frame.
  const [level, setLevel] = useState<Level>('none')
  useEffect(() => feed.subscribe((frame) => setLevel(levelOf(frame))), [feed])

  let label: string
  let colorClass: string
  if (level === 'none') {
    label = 'No hand detected'
    colorClass = 'text-[#9C9AA3]'
  } else if (level === 'low') {
    label = 'Low confidence - improve lighting'
    colorClass = 'text-[#F5A524]'
  } else if (level === 'ok') {
    label = 'Tracking'
    colorClass = 'text-[#9C9AA3]'
  } else {
    label = 'Tracking well'
    colorClass = 'text-[#22C55E]'
  }

  return (
    <div
      data-testid="gesture-confidence"
      className={`flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-xs font-medium ${colorClass}`}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: level === 'none' ? '#9C9AA3' : level === 'low' ? '#F5A524' : '#22C55E' }}
      />
      {label}
    </div>
  )
}
