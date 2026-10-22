import { useEffect, useRef, useState } from 'react'
import { HAND_COLOR, POSE_FOR, notationFor, type SignLayer } from '../core/gestures/signGestures'
import { CssCube, type CssCubeHandle } from './CssCube'

// A try-it-now version of the camera control, with a mouse instead of a
// webcam: raise fingers, hold still, and the layer that sign picks turns.
// It follows the same rules as the real thing -- the fingers pick the layer,
// the right hand turns clockwise and the left hand counter-clockwise.

const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky']
const HOLD_MS = 900
const LAYER_NAME: Record<SignLayer, string> = {
  R: 'Right face',
  L: 'Left face',
  U: 'Top face',
  D: 'Bottom face',
  F: 'Front face',
  B: 'Back face',
  M: 'Middle slice',
  E: 'Equator slice',
  S: 'Standing slice',
}
const LAYERS = Object.keys(POSE_FOR) as SignLayer[]

type Hand = 'Right' | 'Left'

function layerFor(raised: boolean[]): SignLayer | null {
  const pattern = raised.map((r) => (r ? '1' : '0')).join('')
  return LAYERS.find((l) => POSE_FOR[l] === pattern) ?? null
}

export function SignPlayground() {
  const cube = useRef<CssCubeHandle>(null)
  const [hand, setHand] = useState<Hand>('Right')
  // Raised fingers in finger order: index, middle, ring, pinky.
  const [raised, setRaised] = useState([true, true, false, false])
  const [progress, setProgress] = useState(0)
  // The sign that has already turned; changing the sign (or hand) allows another turn.
  const [firedKey, setFiredKey] = useState('')
  const [turns, setTurns] = useState(0)
  // Nothing turns until the visitor touches the demo: the starting pose is
  // only there to show what a sign looks like.
  const [armed, setArmed] = useState(false)

  const layer = layerFor(raised)
  const color = HAND_COLOR[hand]

  // Anything that changes what is being signed starts a fresh hold.
  const key = `${hand}:${raised.join('')}`
  const fired = firedKey === key

  useEffect(() => {
    cube.current?.highlight(layer)
    if (!armed || !layer || fired) return
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / HOLD_MS)
      setProgress(p)
      if (p < 1) {
        raf = requestAnimationFrame(tick)
        return
      }
      void cube.current?.turn(notationFor(layer, hand))
      setFiredKey(key)
      setTurns((n) => n + 1)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [layer, hand, fired, key, armed])

  const order = hand === 'Right' ? [0, 1, 2, 3] : [3, 2, 1, 0]
  const toggle = (finger: number) => {
    setArmed(true)
    setRaised((r) => r.map((v, i) => (i === finger ? !v : v)))
  }
  const setSign = (l: SignLayer) => {
    setArmed(true)
    setRaised(POSE_FOR[l].split('').map((c) => c === '1'))
  }
  const pickHand = (h: Hand) => {
    setArmed(true)
    setHand(h)
  }

  return (
    <div className="grid items-center gap-8 md:grid-cols-[1fr_1fr] md:gap-10">
      <div>
        <div role="group" aria-label="Which hand" className="inline-flex rounded-full bg-black/30 p-1 text-sm">
          {(['Left', 'Right'] as Hand[]).map((h) => (
            <button
              key={h}
              type="button"
              aria-pressed={hand === h}
              data-testid={`sign-hand-${h.toLowerCase()}`}
              onClick={() => pickHand(h)}
              className={`min-h-10 rounded-full px-4 font-semibold transition pointer-coarse:min-h-11 ${hand === h ? 'text-[#16171B]' : 'text-[#9C9AA3] hover:text-[#ECEAE4]'}`}
              style={hand === h ? { background: HAND_COLOR[h] } : undefined}
            >
              {h} hand
            </button>
          ))}
        </div>

        <div className="relative mx-auto mt-6 flex h-64 w-60 items-end justify-center sm:mx-0 sm:h-72 sm:w-72">
          {/* thumb */}
          <span
            aria-hidden
            className="absolute bottom-16 h-16 w-9 rounded-full bg-[#2C2E34]"
            style={{ [hand === 'Right' ? 'left' : 'right']: '0.4rem', transform: `rotate(${hand === 'Right' ? -38 : 38}deg)` }}
          />
          {/* palm */}
          <span aria-hidden className="absolute bottom-0 h-28 w-52 rounded-[2rem] bg-[#2C2E34] sm:w-60" />
          <div className="relative flex items-end gap-2 pb-16 sm:gap-2.5">
            {order.map((f) => {
              const up = raised[f]
              return (
                <button
                  key={f}
                  type="button"
                  data-testid={`finger-${FINGERS[f].toLowerCase()}`}
                  aria-pressed={up}
                  aria-label={`${FINGERS[f]} finger`}
                  onClick={() => toggle(f)}
                  className="w-11 rounded-full transition-all duration-300 ease-[cubic-bezier(.3,1.5,.5,1)] hover:brightness-110 sm:w-12"
                  style={{ height: up ? 140 + (f === 1 ? 14 : f === 3 ? -24 : 0) : 46, background: up ? color : '#4B4D55' }}
                />
              )
            })}
          </div>
          {/* hold ring */}
          <svg className="absolute bottom-4 right-1 sm:right-3" width="52" height="52" viewBox="0 0 52 52" aria-hidden>
            <circle cx="26" cy="26" r="21" fill="none" stroke="#ffffff1f" strokeWidth="5" />
            <circle
              cx="26"
              cy="26"
              r="21"
              fill="none"
              stroke={fired ? '#22C55E' : color}
              strokeOpacity={fired || progress > 0 ? 1 : 0}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${(fired ? 1 : progress) * 132} 132`}
              transform="rotate(-90 26 26)"
            />
          </svg>
        </div>

        <p className="mt-5 flex min-h-[3.25rem] items-baseline gap-3 text-[#C9C7CF]" data-testid="sign-readout" aria-live="polite">
          {layer ? (
            <>
              {/* Keyed on the turn count so it pops once each time a layer turns. */}
              <span key={turns} className={`font-display text-2xl font-bold ${turns ? 'sign-pop' : ''}`} style={{ color }}>
                {notationFor(layer, hand)}
              </span>
              <span>
                {!armed
                  ? 'Tap a finger, or pick a sign, then hold it.'
                  : fired
                    ? 'Turned. Change your fingers to turn again.'
                    : `${LAYER_NAME[layer]}, ${hand === 'Right' ? 'clockwise' : 'counter-clockwise'}. Hold still…`}
              </span>
            </>
          ) : (
            'That is not a sign. Try raising two fingers.'
          )}
        </p>
      </div>

      <div className="flex flex-col items-center gap-6 md:gap-8">
        <div className="grid h-60 w-full place-items-center sm:h-72">
          <div className="scale-[0.85] sm:scale-100">
            <CssCube ref={cube} cubie={58} />
          </div>
        </div>
        {/* Three to a row on a phone (R U F / L D B / M E S), one row from 640 px. */}
        <ul aria-label="All signs" className="grid w-full grid-cols-3 gap-1.5 sm:grid-cols-9">
          {LAYERS.map((l) => (
            <li key={l}>
              <button
                type="button"
                data-testid={`sign-${l}`}
                aria-label={`${l}: ${LAYER_NAME[l]}`}
                onClick={() => setSign(l)}
                className={`flex min-h-11 w-full flex-col items-center justify-center gap-1 rounded-lg border py-1.5 transition ${layer === l ? 'bg-white/10' : 'border-white/10 hover:border-white/30'}`}
                style={layer === l ? { borderColor: color } : undefined}
              >
                <span className="flex h-5 items-end gap-0.5" aria-hidden>
                  {(hand === 'Right' ? [0, 1, 2, 3] : [3, 2, 1, 0]).map((f) => (
                    <span
                      key={f}
                      className="w-1 rounded-sm"
                      style={{ height: POSE_FOR[l][f] === '1' ? 18 : 7, background: POSE_FOR[l][f] === '1' ? color : '#4B4D55' }}
                    />
                  ))}
                </span>
                <span className="font-mono text-sm text-[#ECEAE4]">{l}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="text-sm text-[#9C9AA3]" data-testid="sign-turns">
          {turns === 0 ? 'Nothing turned yet.' : `${turns} ${turns === 1 ? 'turn' : 'turns'} made.`}
        </p>
      </div>
    </div>
  )
}
