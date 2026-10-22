import { memo, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Handedness } from '../core/gestures/landmarks'
import { HAND_COLOR, POSE_FOR, notationFor, type SignLayer } from '../core/gestures/signGestures'
import { CLICK_EASING } from '../motion/easing'
import { prefersReducedMotion } from '../motion/stagger'
import { MoveChip, TurnGlyph } from './cube/MoveChip'
import { CssCube, type CssCubeHandle } from './CssCube'
import { FINGER_NAMES, fingersOf } from './home/fingers'
import { Hand, SignGlyph } from './home/Hand'

// A try-it-now version of the camera control, with taps instead of a webcam.
// It follows the game's rules: the fingers pick the layer, the hand picks the
// direction (right clockwise, left counter-clockwise), and a sign held still
// turns its layer once; change the sign to turn again.

const Cube = memo(CssCube)
// As long as the game takes: with its vote and its hold, a turn comes a median
// of 660 ms after the pose is formed (docs/research/temporal-filtering.md).
const HOLD_MS = 660
const LAYER_WORDS: Record<SignLayer, string> = {
  R: 'the right layer',
  L: 'the left layer',
  U: 'the top layer',
  D: 'the bottom layer',
  F: 'the front layer',
  B: 'the back layer',
  M: 'the middle slice, between left and right',
  E: 'the middle slice, between top and bottom',
  S: 'the middle slice, between front and back',
}
// Grouped the way they are remembered.
const GROUPS: { title: string; layers: SignLayer[] }[] = [
  { title: 'Count from the index finger', layers: ['R', 'U', 'F'] },
  { title: 'Count from the little finger', layers: ['L', 'D', 'B'] },
  { title: 'Slices', layers: ['M', 'E', 'S'] },
]
const LAYERS = GROUPS.flatMap((g) => g.layers)

const layerFor = (raised: boolean[]) => LAYERS.find((l) => POSE_FOR[l] === raised.map(Number).join('')) ?? null

// "Index and middle", "No fingers".
function fingerWords(raised: boolean[]): string {
  const up = FINGER_NAMES.filter((_, i) => raised[i])
  if (!up.length) return 'No fingers'
  const words = up.length === 1 ? `${up[0]} finger` : `${up.slice(0, -1).join(', ')} and ${up[up.length - 1]}`
  return words[0].toUpperCase() + words.slice(1)
}

export function SignPlayground() {
  const cube = useRef<CssCubeHandle>(null)
  const hold = useRef<SVGRectElement>(null)
  const chip = useRef<HTMLDivElement>(null)
  const [hand, setHand] = useState<Handedness>('Right')
  // Raised fingers in finger order: index, middle, ring, little.
  const [raised, setRaised] = useState(() => fingersOf(POSE_FOR.U))
  // The sign that has already turned; changing the sign (or hand) allows another turn.
  const [firedKey, setFiredKey] = useState('')
  const [turns, setTurns] = useState(0)
  // Nothing turns until the visitor touches the demo: the starting pose is
  // only there to show what a sign looks like.
  const [armed, setArmed] = useState(false)

  const layer = layerFor(raised)
  const move = layer && notationFor(layer, hand)
  // Anything that changes what is being signed starts a fresh hold.
  const key = `${hand}:${raised.map(Number).join('')}`
  const fired = firedKey === key

  useEffect(() => {
    cube.current?.highlight(layer)
    if (!armed || !move) return
    if (fired) return
    // The outline fills over the hold; then the layer turns, and lands with a click.
    const fill = hold.current?.animate?.([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: HOLD_MS, fill: 'forwards' })
    const timer = window.setTimeout(() => {
      setFiredKey(key)
      void cube.current?.turn(move).then(() => {
        setTurns((n) => n + 1)
        if (!prefersReducedMotion()) chip.current?.animate?.([{ transform: 'scale(0.88)' }, { transform: 'scale(1)' }], { duration: 300, easing: CLICK_EASING })
      })
    }, HOLD_MS)
    return () => {
      window.clearTimeout(timer)
      fill?.cancel()
    }
  }, [layer, move, fired, key, armed])

  const toggle = (finger: number) => {
    setArmed(true)
    setRaised((r) => r.map((v, i) => (i === finger ? !v : v)))
  }
  const pickSign = (l: SignLayer) => {
    setArmed(true)
    setRaised(fingersOf(POSE_FOR[l]))
  }
  const pickHand = (h: Handedness) => {
    setArmed(true)
    setHand(h)
  }

  const status = !layer
    ? 'Change a finger, or pick a sign below.'
    : !armed
      ? 'Tap a finger or pick a sign, then hold still.'
      : fired
        ? 'Turned. Change a finger to turn again.'
        : 'Hold still…'

  return (
    <div className="pg">
      <div role="group" aria-label="Which hand" className="pg-switch grid grid-cols-2 gap-2 self-start">
        {(['Left', 'Right'] as const).map((h) => (
          <button
            key={h}
            type="button"
            aria-pressed={hand === h}
            data-testid={`sign-hand-${h.toLowerCase()}`}
            onClick={() => pickHand(h)}
            className="pg-hand-key"
            style={{ '--hand': HAND_COLOR[h] } as CSSProperties}
          >
            <TurnGlyph kind={h === 'Right' ? 'clockwise' : 'counter'} size={18} />
            <span className="leading-tight">
              <span className="block font-bold">{h} hand</span>
              <span className="block text-[0.8rem]">{h === 'Right' ? 'clockwise' : 'counter-clockwise'}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="pg-hand grid place-items-center text-[44px] sm:text-[50px] lg:text-[52px]">
        <Hand side={hand} raised={raised} onToggle={toggle} />
      </div>

      <div className="pg-cube flex flex-col items-center gap-3">
        <div className="grid h-60 w-full place-items-center sm:h-72">
          <div className="sm:scale-110 lg:scale-125">
            <Cube ref={cube} cubie={48} pace={380} />
          </div>
        </div>
        <p className="text-sm text-fg-faint" data-testid="sign-turns">
          {turns === 0 ? 'Nothing turned yet.' : `${turns} ${turns === 1 ? 'turn' : 'turns'} made.`}
        </p>
      </div>

      <div className="pg-readout flex min-h-22 items-start gap-4" data-testid="sign-readout" aria-live="polite">
        <div ref={chip} className="pg-hold" data-hand={hand}>
          {move ? <MoveChip move={move} size="lg" /> : <span className="pg-blank" />}
          <svg viewBox="0 0 68 68" aria-hidden>
            <rect
              ref={hold}
              x="2"
              y="2"
              width="64"
              height="64"
              rx="16"
              pathLength={1}
              fill="none"
              stroke={HAND_COLOR[hand]}
              strokeWidth="3"
              strokeLinecap="butt"
              strokeDasharray="1"
              strokeDashoffset={fired ? 0 : 1}
              opacity={armed && move ? 1 : 0}
            />
          </svg>
        </div>
        <div className="pt-1 text-pretty">
          <p className="font-bold text-fg">
            {fingerWords(raised)}: {layer ? LAYER_WORDS[layer] : 'not a sign'}.
          </p>
          <p className="mt-1 text-sm text-fg-faint">{status}</p>
        </div>
      </div>

      <div role="group" aria-label="All nine signs" className="pg-signs grid gap-4 sm:grid-cols-3 sm:gap-5">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="mb-2 text-sm text-fg-faint">{g.title}</p>
            <ul className="grid grid-cols-3 gap-1.5">
              {g.layers.map((l) => (
                <li key={l}>
                  <button
                    type="button"
                    data-testid={`sign-${l}`}
                    aria-label={`${l}: ${LAYER_WORDS[l]}`}
                    aria-pressed={layer === l}
                    onClick={() => pickSign(l)}
                    className="sign-key"
                    style={{ '--hand': HAND_COLOR[hand] } as CSSProperties}
                  >
                    <SignGlyph pose={POSE_FOR[l]} side={hand} />
                    <span className="font-display text-lg font-bold leading-none">{l}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
