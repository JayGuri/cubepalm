import type { Handedness, LandmarkFrame } from './landmarks'
import { LandmarkFilter } from './oneEuro'
import { marginReader } from './poseReaders'
import { DEFAULT_SIGN_OPTIONS, type SignOptions } from './signGestures'
import { TRAINED_MARGINS } from './trainedReaders'

// The two ways the app can read signs, chosen in Settings.
//
//   classic  the rule the app shipped with: a finger is raised when its tip is
//            far from the wrist. Tuned by hand with a real camera.
//   precise  three changes that the studies in docs/research/ measured:
//            distances are taken on square pixels (the camera's picture is not
//            square, and MediaPipe's numbers are fractions of each side); a
//            finger must be clearly up or clearly down, so a relaxed hand is no
//            sign at all; and the landmarks are smoothed first, which that
//            stricter reading needs when the tracking is jittery.
//
// Precise is measured on a hand model, not yet on people, which is why classic
// stays the default.

export type SignReadingMode = 'classic' | 'precise'

const preciseReader = marginReader(TRAINED_MARGINS)

export function signOptions(mode: SignReadingMode, swapHands: boolean): SignOptions {
  if (mode === 'classic') return { ...DEFAULT_SIGN_OPTIONS, swapHands }
  return { ...DEFAULT_SIGN_OPTIONS, swapHands, squarePixels: true, reader: preciseReader }
}

/**
 * Smooths each hand's landmarks from frame to frame. One filter per hand, kept
 * between frames; a hand that leaves the picture starts afresh when it returns,
 * so it is not dragged from where it was last seen.
 */
export function createSmoother(resetAfterMs = 400): (frame: LandmarkFrame) => LandmarkFrame {
  const filters = new Map<Handedness, { filter: LandmarkFilter; lastMs: number }>()
  return (frame) => ({
    ...frame,
    hands: frame.hands.map((hand) => {
      let entry = filters.get(hand.handedness)
      if (!entry || frame.timestampMs - entry.lastMs > resetAfterMs) {
        entry = { filter: new LandmarkFilter(), lastMs: frame.timestampMs }
        filters.set(hand.handedness, entry)
      }
      entry.lastMs = frame.timestampMs
      return { ...hand, landmarks: entry.filter.next(hand.landmarks, frame.timestampMs) }
    }),
  })
}
