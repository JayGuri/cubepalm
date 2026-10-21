// How things move on CubePalm. A real cube's layer does not glide to a stop: it
// is flung, runs a hair past the quarter turn and is pulled back by the detent,
// the little click you feel in your fingers. Everything here is that click, at
// different strengths: the step response of a damped spring, rescaled so it
// starts at 0 at t = 0 and is exactly 1 at t = 1.

export type Ease = (t: number) => number

/**
 * A spring released from rest at 0 toward 1.
 * `zeta` is its damping ratio (below 1 it overshoots by exp(-zeta*pi/sqrt(1-zeta^2)));
 * `omega` is its natural frequency in units of the whole animation.
 */
export function springEase(zeta: number, omega: number): Ease {
  const root = Math.sqrt(1 - zeta * zeta)
  const wd = omega * root
  return (t) => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    return 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + (zeta / root) * Math.sin(wd * t))
  }
}

/** A layer's quarter turn: arrives, runs about 2% past (under 2 degrees) and settles. */
export const turnEase = springEase(0.78, 9)
/** A sticker or a tile clicking into place: a firmer snap, about 4% past. */
export const clickEase = springEase(0.72, 8.5)
/** A panel arriving: no visible overshoot. */
export const softEase = springEase(0.86, 7.5)

/** The same curve as a CSS `linear()` easing, for transitions and the Web Animations API. */
export function cssLinear(ease: Ease, samples = 32): string {
  const points: string[] = []
  for (let i = 0; i <= samples; i++) points.push(i === samples ? '1' : String(+ease(i / samples).toFixed(4)))
  return `linear(${points.join(', ')})`
}

export const TURN_EASING = cssLinear(turnEase)
export const CLICK_EASING = cssLinear(clickEase)
export const SOFT_EASING = cssLinear(softEase, 28)
