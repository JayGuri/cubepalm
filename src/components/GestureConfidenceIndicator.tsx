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

// A small light: grey with no hand, orange when the reading is shaky, green when it is good.
const READING: Record<Level, { label: string; light: string; text: string }> = {
  none: { label: 'No hand detected', light: 'bg-fg-faint/60', text: 'text-fg-faint' },
  low: { label: 'Low confidence: try more light', light: 'bg-sticker-orange', text: 'text-sticker-orange' },
  ok: { label: 'Tracking', light: 'bg-sticker-green/70', text: 'text-fg-muted' },
  good: { label: 'Tracking well', light: 'bg-sticker-green', text: 'text-fg' },
}

export function GestureConfidenceIndicator({ feed }: GestureConfidenceIndicatorProps) {
  // Re-renders only when the reading changes band, not on every frame.
  const [level, setLevel] = useState<Level>('none')
  useEffect(() => feed.subscribe((frame) => setLevel(levelOf(frame))), [feed])
  const { label, light, text } = READING[level]

  return (
    <div data-testid="gesture-confidence" className={`flex min-w-0 items-center gap-1.5 text-xs font-medium ${text}`}>
      <span aria-hidden className={`sticker size-2 shrink-0 rounded-xs transition-colors duration-300 ${light}`} />
      <span className="truncate">{label}</span>
    </div>
  )
}
