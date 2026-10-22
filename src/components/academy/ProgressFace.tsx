import { useEffect, useMemo, useState } from 'react'
import { StickerGrid } from '../cube/StickerGrid'
import { faceColours, lastSeen, markSeen } from './progress'

// Progress as one face of a cube: the eight lessons are the eight stickers
// round a centre that never moves. A lesson not yet done is a scrambled
// sticker; a finished one turns over to the Academy's orange, so the whole
// course is a face being solved. (The centre becomes "your first full solve"
// later; for now it is just the face's centre.)

export function ProgressFace({ done, sticker, gap, className = '' }: { done: string[]; sticker: number; gap: number; className?: string }) {
  const [shown, setShown] = useState(() => lastSeen() ?? done)
  useEffect(() => {
    markSeen(done)
    // A beat after the page appears, so the turn is seen.
    const t = window.setTimeout(() => setShown(done), 420)
    return () => clearTimeout(t)
  }, [done])
  const colours = useMemo(() => faceColours(shown), [shown])
  return <StickerGrid colours={colours} sticker={sticker} gap={gap} round={0.18} each={70} duration={460} className={className} />
}
