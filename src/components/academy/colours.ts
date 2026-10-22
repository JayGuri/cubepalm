import type { Vec3 } from '../CssCube'

// The Academy's small cubes. The lessons hold the cube with white on the bottom
// and blue in front (the play screen's FLIP_COLORS does the same to the big
// cube), and CssCube paints it the usual way round, so white trades with yellow
// and green with blue.
const FLIP: Record<string, string> = { '#FFFFFF': '#FFD500', '#FFD500': '#FFFFFF', '#2FB36B': '#2F6FDE', '#2F6FDE': '#2FB36B' }
export const academyColour = (colour: string) => FLIP[colour] ?? colour

const turned = (v: Vec3) => v.filter((c) => c !== 0).length
const centre = (h: Vec3) => turned(h) === 1
const facingUp = (n: Vec3) => n[1] === 1

// The stickers a lesson's picture shows in colour, by the piece's home and the
// way the sticker faces: the pieces the lesson is about and the ones already
// solved. Everything else is grey. Centres are always shown: they are what the
// colours are matched against.
const SHOWN: Record<string, (home: Vec3, normal: Vec3) => boolean> = {
  basics: () => false,
  cross: (h) => h[1] === -1 && turned(h) === 2,
  corners: (h) => h[1] === -1,
  middle: (h) => h[1] <= 0,
  'top-cross': (h, n) => h[1] <= 0 || (turned(h) === 2 && facingUp(n)),
  'top-face': (h, n) => h[1] <= 0 || facingUp(n),
  'top-corners': (h, n) => h[1] <= 0 || facingUp(n) || turned(h) === 3,
}

/** Colours for a lesson's cube: Academy colours, and grey for what does not matter yet. */
export function lessonColour(lessonId: string) {
  const shown = SHOWN[lessonId]
  return (home: Vec3, normal: Vec3, colour: string) => (!shown || centre(home) || shown(home, normal) ? academyColour(colour) : null)
}

// The first layer is on the bottom, so its lessons look at the cube from below.
const FROM_BELOW = { x: 30, y: -36 }
export const lessonView = (lessonId: string) => (lessonId === 'cross' || lessonId === 'corners' ? FROM_BELOW : undefined)
