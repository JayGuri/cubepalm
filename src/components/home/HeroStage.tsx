import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { POSE_FOR, signForNotation, type SignLayer } from '../../core/gestures/signGestures'
import type { Handedness } from '../../core/gestures/landmarks'
import { splitMoves } from '../../core/notation'
import { useReducedMotion } from '../../motion/stagger'
import { CssCube, type CssCubeHandle } from '../CssCube'
import { Hand } from './Hand'
import { REST, fingersOf } from './fingers'

// The home page's one orchestrated moment. The cube is there, scrambled, in
// the first frame; your two hands rise into view and solve it, every turn made
// by the finger sign that makes it in the game: the right hand turns
// clockwise, the left hand turns back. Then it rests, and now and then the
// hands scramble it and solve it again, only while it is on screen.

// Drawn once per hand change, not once per frame of a turn.
const Cube = memo(CssCube)
const SCENE_WIDTH = 560

// Three turns for each hand, so the first solve (their undo) shows six signs.
const FIRST_SCRAMBLE = "R U' F L' D B'"
const LAYERS: SignLayer[] = ['R', 'L', 'U', 'D', 'F', 'B', 'M', 'E', 'S']
const AXIS: Record<SignLayer, number> = { R: 0, L: 0, M: 0, U: 1, D: 1, E: 1, F: 2, B: 2, S: 2 }

const undo = (moves: string[]) => [...moves].reverse().map((m) => (m.endsWith("'") ? m[0] : `${m}'`))

// Any of the nine signs, either hand, never the same axis twice running, so
// no turn undoes or merges with the one before it.
function randomScramble(length = 9): string[] {
  const out: string[] = []
  while (out.length < length) {
    const layer = LAYERS[Math.floor(Math.random() * LAYERS.length)]
    const last = out[out.length - 1]
    if (last && AXIS[last[0] as SignLayer] === AXIS[layer]) continue
    out.push(Math.random() < 0.5 ? layer : `${layer}'`)
  }
  return out
}

export function HeroStage() {
  const box = useRef<HTMLDivElement>(null)
  const cube = useRef<CssCubeHandle>(null)
  const reduced = useReducedMotion()
  const [sign, setSign] = useState<{ hand: Handedness; layer: SignLayer } | null>(null)

  // Fit the scene to its box before the first paint.
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => el.style.setProperty('--k', String(el.clientWidth / SCENE_WIDTH))
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = box.current
    if (reduced || !el) return
    let alive = true
    let onScreen = typeof IntersectionObserver === 'undefined'
    let wake = () => {}
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      if (onScreen) wake()
    })
    observer?.observe(el)
    const seen = () => (onScreen ? Promise.resolve() : new Promise<void>((resolve) => (wake = resolve)))
    const pause = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

    // Each turn: the hand makes the sign, a beat, then the layer turns.
    const sign = async (moves: string[], lead: number, ms: number) => {
      for (const move of moves) {
        await seen()
        if (!alive) return
        setSign(signForNotation(move))
        await pause(lead)
        if (!alive) return
        await cube.current?.play(move, ms)
      }
    }

    void (async () => {
      await pause(420) // the hands rise in
      await sign(undo(splitMoves(FIRST_SCRAMBLE)), 110, 240)
      while (alive) {
        setSign(null)
        await pause(6500)
        const scramble = randomScramble()
        await sign(scramble, 80, 190)
        if (!alive) return
        setSign(null)
        await pause(1300)
        await sign(undo(scramble), 110, 240)
      }
    })()
    return () => {
      alive = false
      observer?.disconnect()
      wake()
    }
  }, [reduced])

  const fingers = (side: Handedness) => (sign?.hand === side ? fingersOf(POSE_FOR[sign.layer]) : REST)

  return (
    <div ref={box} className="hero-stage" role="img" aria-label="Two hands solving a cube, one finger sign for each turn">
      <div className="hero-scene">
        <div className="hero-light" />
        <div className="hero-shadow" />
        <div className="hero-cube">
          <Cube ref={cube} cubie={62} setup={reduced ? undefined : FIRST_SCRAMBLE} tumble={!reduced} followPointer={!reduced} />
        </div>
        <Hand side="Left" raised={fingers('Left')} className="hero-hand" />
        <Hand side="Right" raised={fingers('Right')} className="hero-hand" />
      </div>
    </div>
  )
}
