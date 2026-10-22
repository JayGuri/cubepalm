import { useEffect, useState } from 'react'
import { StickerGrid } from '../cube/StickerGrid'
import { prefersReducedMotion } from '../../motion/stagger'
import { STICKER } from './places'

// Faces of stickers that tell the state of a page: still loading (a face
// scrambling and solving, over and over), or lost (a face that came apart).

const { white: W, yellow: Y, red: R, orange: O, green: G, blue: B } = STICKER
const MIXES = [
  [R, W, G, B, Y, O, G, R, W],
  [O, B, Y, W, G, R, B, Y, G],
  [Y, G, W, R, O, B, W, O, R],
]
const SOLVES = [G, O, B, R, W, Y]

/**
 * The fallback while a page's code downloads. It waits a moment first, so a
 * quick load shows nothing at all instead of a flash.
 */
export function PageLoader() {
  const [step, setStep] = useState(-1)
  useEffect(() => {
    const still = prefersReducedMotion()
    const show = window.setTimeout(() => setStep(0), 200)
    const turn = still ? 0 : window.setInterval(() => setStep((s) => (s < 0 ? s : s + 1)), 700)
    return () => {
      clearTimeout(show)
      clearInterval(turn)
    }
  }, [])
  // Even steps are scrambled, odd ones solved in the next colour.
  const colours = step % 2 === 1 ? Array<string>(9).fill(SOLVES[((step - 1) / 2) % SOLVES.length]) : MIXES[Math.max(0, step / 2) % MIXES.length]
  return (
    <div className="grid min-h-dvh place-items-center bg-ink" role="status">
      <div className={`flex flex-col items-center gap-4 transition-opacity duration-200 ${step < 0 ? 'opacity-0' : ''}`}>
        <StickerGrid colours={colours} sticker={16} gap={3} each={40} duration={360} />
        <span className="text-sm text-fg-faint">Loading the page</span>
      </div>
    </div>
  )
}

/** A face that comes apart as it appears: what is shown when a page is missing or broken. */
export function ScrambledFace({ sticker = 30 }: { sticker?: number }) {
  const [colours, setColours] = useState(() => (prefersReducedMotion() ? MIXES[0] : Array<string>(9).fill(G)))
  useEffect(() => {
    const t = window.setTimeout(() => setColours(MIXES[0]), 250)
    return () => clearTimeout(t)
  }, [])
  return <StickerGrid colours={colours} sticker={sticker} gap={Math.round(sticker / 7)} from="first" each={55} duration={460} />
}
