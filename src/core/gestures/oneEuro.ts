import type { Landmark } from './landmarks'

// The One-Euro filter (Casiez, Roussel and Vogel, CHI 2012): a low-pass filter
// whose cut-off rises with speed. A still hand is smoothed hard, so jitter goes;
// a moving hand is smoothed lightly, so it does not lag. It has two knobs:
// `minCutoff` (how hard to smooth when still) and `beta` (how quickly to let go
// as the signal speeds up).

const TWO_PI = 2 * Math.PI

/** The weight of the new sample in an exponential filter with this cut-off, at this sample interval. */
const alpha = (cutoffHz: number, dtSeconds: number) => {
  const tau = 1 / (TWO_PI * cutoffHz)
  return 1 / (1 + tau / dtSeconds)
}

export interface OneEuroOptions {
  /** Cut-off in Hz when the signal is not moving. Lower smooths more and lags more. */
  minCutoff: number
  /** How much the cut-off rises per unit of speed. 0 makes it a plain low-pass filter. */
  beta: number
  /** Cut-off for the speed estimate itself. */
  derivativeCutoff: number
}

// Landmarks are fractions of the picture (0 to 1), so a moving hand has a speed
// well under 1 per second and `beta` has to be large to matter.
export const DEFAULT_ONE_EURO: OneEuroOptions = { minCutoff: 1.5, beta: 30, derivativeCutoff: 1 }

/** One number, filtered. */
export class OneEuro {
  private previous: number | null = null
  private previousTime = 0
  private speed = 0
  private readonly options: OneEuroOptions

  constructor(options: OneEuroOptions = DEFAULT_ONE_EURO) {
    this.options = options
  }

  /** The filtered value for a sample taken at `timeMs`. */
  next(value: number, timeMs: number): number {
    if (this.previous === null) {
      this.previous = value
      this.previousTime = timeMs
      return value
    }
    const dt = (timeMs - this.previousTime) / 1000
    // A repeated or out-of-order timestamp carries no new information.
    if (dt <= 0) return this.previous
    const rawSpeed = (value - this.previous) / dt
    this.speed += alpha(this.options.derivativeCutoff, dt) * (rawSpeed - this.speed)
    const cutoff = this.options.minCutoff + this.options.beta * Math.abs(this.speed)
    this.previous += alpha(cutoff, dt) * (value - this.previous)
    this.previousTime = timeMs
    return this.previous
  }
}

/** All 21 landmarks of one hand, each coordinate filtered on its own. */
export class LandmarkFilter {
  private readonly filters: OneEuro[] = []
  private readonly options: OneEuroOptions

  constructor(options: OneEuroOptions = DEFAULT_ONE_EURO) {
    this.options = options
  }

  next(landmarks: Landmark[], timeMs: number): Landmark[] {
    return landmarks.map((p, i) => {
      const at = (axis: number) => (this.filters[i * 3 + axis] ??= new OneEuro(this.options))
      return { x: at(0).next(p.x, timeMs), y: at(1).next(p.y, timeMs), z: at(2).next(p.z, timeMs) }
    })
  }
}
