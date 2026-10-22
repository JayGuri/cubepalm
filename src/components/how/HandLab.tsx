import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { curlForPose, makeModelHand } from '../../core/gestures/handModel'
import { handScale } from '../../core/gestures/landmarkMath'
import type { Handedness, Landmark } from '../../core/gestures/landmarks'
import { distanceReader, fingerFeatures, marginReader, squarePixels } from '../../core/gestures/poseReaders'
import { DEFAULT_SIGN_OPTIONS, notationFor, POSE_FOR, type SignLayer } from '../../core/gestures/signGestures'
import { TRAINED_MARGINS } from '../../core/gestures/trainedReaders'
import { MoveChip } from '../cube/MoveChip'
import { HoldTiming } from './HoldTiming'
import { useWidth } from './howMath'
import { Choice, Key, Section, Slider } from './ui'

type Curl = [number, number, number, number]
type Units = 'mediapipe' | 'square'

const ASPECT = 4 / 3
const RATIO = DEFAULT_SIGN_OPTIONS.extendedRatio
const M = TRAINED_MARGINS
const FINGERS = ['Index', 'Middle', 'Ring', 'Little']
const LAYER_FOR = Object.fromEntries(Object.entries(POSE_FOR).map(([layer, pose]) => [pose, layer as SignLayer])) as Record<string, SignLayer>
const classicReader = distanceReader(RATIO)
const preciseReader = marginReader(M)
// A relaxed, half-open hand: each finger between 35% and 65% curled, as in the study.
const RELAXED: Curl = [0.35, 0.4, 0.45, 0.5]

const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [9, 10], [10, 11], [11, 12],
  [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
]
const TIPS = [8, 12, 16, 20]
const HAND_VAR: Record<Handedness, string> = { Right: 'var(--color-hand-right)', Left: 'var(--color-hand-left)' }

function describe(bits: string): string {
  if (bits.includes('?')) return 'No sign: a finger is neither clearly up nor clearly down'
  if (bits === '1111') return 'No sign: an open hand (it orbits the view)'
  if (bits === '0000') return 'No sign: a fist (held still, it locks the view)'
  return LAYER_FOR[bits] ? '' : 'No sign: not one of the nine patterns'
}

function Reading({ bits, hand, testId }: { bits: string; hand: Handedness; testId: string }) {
  const layer = LAYER_FOR[bits]
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3" data-testid={testId} data-bits={bits} data-sign={layer ? notationFor(layer, hand) : ''}>
      <div className="flex gap-1 rounded-lg bg-plastic p-1" role="img" aria-label={`Fingers read as ${bits}, index finger first`}>
        {[...bits].map((b, i) => (
          <span key={i} className={`how-bit how-bit-${b === '?' ? 'q' : b}`} style={{ ['--hand' as string]: HAND_VAR[hand] }}>
            {b}
          </span>
        ))}
      </div>
      {layer ? (
        <span className="inline-flex items-center gap-2 text-sm text-fg-muted">
          reads as <MoveChip move={notationFor(layer, hand)} state="current" />
        </span>
      ) : (
        <span className="text-sm text-fg-muted">{describe(bits)}</span>
      )}
    </div>
  )
}

/** A value on a track, with the line or lines it is judged against. */
function Gauge({ value, min, max, marks, label }: { value: number; min: number; max: number; marks: number[]; label: string }) {
  const at = (v: number) => `${Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100))}%`
  return (
    <span className="how-gauge" role="img" aria-label={label}>
      <span className="how-gauge-fill" style={{ width: at(value) }} />
      {marks.map((m) => (
        <span key={m} className="how-gauge-mark" style={{ left: at(m) }} />
      ))}
    </span>
  )
}

function Frame({ points, width, height, hand, active, title, scale }: { points: Landmark[]; width: number; height: number; hand: Handedness; active: boolean; title: string; scale: number }) {
  // Points in this frame's own units, as pixels of the drawing.
  const px = points.map((p) => ({ x: p.x * scale * (width / height === 1 ? 1 : ASPECT), y: p.y * scale, z: p.z }))
  const radius = RATIO * handScale(px)
  const wrist = px[0]
  return (
    <figure className={`how-frame ${active ? 'how-frame-on' : ''}`}>
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" role="img" aria-label={`${title}: the 21 landmarks of the model hand`}>
        <rect width={width} height={height} rx="10" className="fill-plastic" />
        <circle cx={wrist.x} cy={wrist.y} r={radius} className="how-reach" />
        {BONES.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={px[a].x} y1={px[a].y} x2={px[b].x} y2={px[b].y} stroke={HAND_VAR[hand]} strokeWidth="3" strokeLinecap="round" opacity={a === 0 && b === 1 ? 0.5 : 0.9} />
        ))}
        {px.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={TIPS.includes(i) ? 5 : 3} className={TIPS.includes(i) ? 'fill-fg' : 'fill-ink'} stroke={HAND_VAR[hand]} strokeWidth="1.5" />
        ))}
      </svg>
      <figcaption className="mt-2 text-xs leading-snug text-fg-faint">{title}</figcaption>
    </figure>
  )
}

function RollChart({ curl, pitch, hand, roll }: { curl: Curl; pitch: number; hand: Handedness; roll: number }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const series = useMemo(() => {
    const rolls = Array.from({ length: 61 }, (_, i) => -90 + i * 3)
    return rolls.map((r) => {
      const lm = makeModelHand({ curl, pitch, roll: r, handedness: hand }).landmarks
      return { roll: r, raw: fingerFeatures(lm, 3).tipRatio, square: fingerFeatures(squarePixels(lm, ASPECT), 3).tipRatio }
    })
  }, [curl, pitch, hand])
  const height = 220
  const pad = { l: 40, r: 92, t: 14, b: 30 }
  const values = series.flatMap((s) => [s.raw, s.square]).concat(RATIO)
  const lo = Math.floor((Math.min(...values) - 0.05) * 10) / 10
  const hi = Math.ceil((Math.max(...values) + 0.05) * 10) / 10
  const x = (r: number) => pad.l + ((r + 90) / 180) * (width - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (height - pad.t - pad.b)
  const path = (k: 'raw' | 'square') => series.map((s, i) => `${i ? 'L' : 'M'}${x(s.roll).toFixed(1)},${y(s[k]).toFixed(1)}`).join('')
  const ticks = Array.from({ length: Math.round((hi - lo) / 0.1) + 1 }, (_, i) => +(lo + i * 0.1).toFixed(1)).filter((_, i, a) => a.length < 8 || i % 2 === 0)
  const end = series[series.length - 1]
  const now = series.reduce((a, b) => (Math.abs(b.roll - roll) < Math.abs(a.roll - roll) ? b : a))
  return (
    <div ref={ref} className="min-w-0">
      <svg width={width} height={height} className="block" role="img" aria-label={`The little finger's tip-to-wrist distance in hand lengths as the hand turns from -90 to 90 degrees. In MediaPipe's numbers it runs from ${Math.min(...series.map((s) => s.raw)).toFixed(2)} to ${Math.max(...series.map((s) => s.raw)).toFixed(2)}; in square pixels it stays at ${series[0].square.toFixed(2)}. The threshold is ${RATIO}.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="how-grid" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="how-tick">
              {t.toFixed(1)}
            </text>
          </g>
        ))}
        {[-90, -45, 0, 45, 90].map((r) => (
          <text key={r} x={x(r)} y={height - 8} textAnchor="middle" className="how-tick">
            {r}°
          </text>
        ))}
        <line x1={pad.l} x2={width - pad.r} y1={y(RATIO)} y2={y(RATIO)} className="how-threshold" />
        <text x={width - pad.r + 6} y={y(RATIO) + 4} className="how-tick">
          {RATIO}: raised
        </text>
        <line x1={x(roll)} x2={x(roll)} y1={pad.t} y2={height - pad.b} className="how-now" />
        <path d={path('square')} className="how-line-quiet" />
        <path d={path('raw')} className="how-line-live" />
        <circle cx={x(now.roll)} cy={y(now.raw)} r="4.5" className="how-dot-live" />
        <text x={width - pad.r + 6} y={y(end.raw) + (end.raw < end.square ? 14 : -6)} className="how-label">
          MediaPipe&apos;s
        </text>
        <text x={width - pad.r + 6} y={y(end.square) + (end.raw < end.square ? -6 : 14)} className="how-label">
          square pixels
        </text>
      </svg>
    </div>
  )
}

// docs/research/sign-recognition.md, "Signs read correctly as one thing varies: turn in the picture (roll)".
const ROLL_STUDY = { angles: [0, 15, 30, 45, 60, 90], shipped: ['99.9%', '79.8%', '72.8%', '70.7%', '73.0%', '100.0%'], square: ['100.0%', '100.0%', '100.0%', '100.0%', '100.0%', '100.0%'] }

export function HandLab() {
  const [curl, setCurl] = useState<Curl>(curlForPose(POSE_FOR.S))
  const [roll, setRoll] = useState(30)
  const [pitch, setPitch] = useState(0)
  const [hand, setHand] = useState<Handedness>('Right')
  const [units, setUnits] = useState<Units>('mediapipe')

  const landmarks = useMemo(() => makeModelHand({ curl, roll, pitch, handedness: hand, at: [0.5, 0.74] }).landmarks, [curl, roll, pitch, hand])
  const square = useMemo(() => squarePixels(landmarks, ASPECT), [landmarks])
  const classicInput = units === 'square' ? square : landmarks
  const classicBits = classicReader(classicInput)
  const preciseBits = preciseReader(square)
  const classicFeatures = FINGERS.map((_, f) => fingerFeatures(classicInput, f))
  const preciseFeatures = FINGERS.map((_, f) => fingerFeatures(square, f))
  const setFinger = (f: number, v: number) => setCurl((c) => c.map((x, i) => (i === f ? v : x)) as Curl)
  const preset = (c: Curl) => setCurl(c)
  const studyCol = ROLL_STUDY.angles.reduce((a, b) => (Math.abs(b - Math.abs(roll)) < Math.abs(a - Math.abs(roll)) ? b : a))

  return (
    <Section
      id="hands"
      title="Reading a hand"
      lead={
        <p>
          MediaPipe reports 21 points on each hand. CubePalm reads four bits from them, one per finger, and nine of the sixteen patterns are signs. Below is the app&apos;s posable
          model hand, read live by both of the app&apos;s readers.
        </p>
      }
    >
      <p className="how-note mt-6 max-w-2xl rounded-xl px-4 py-3 text-sm text-fg-muted">
        These are model hands: the pose is set by you, so it is known exactly, which a camera can never tell you. Every number in this section describes the readers on the
        model, not on people. Recordings of real hands are being collected with the <Link to="/record" className={`text-fg ${'underline decoration-white/35 underline-offset-4'}`}>recorder</Link>, and
        those will decide which reader is the default.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="how-panel plastic min-w-0 rounded-2xl p-4 sm:p-6">
          <div className="grid grid-cols-[4fr_3fr] items-start gap-3">
            <Frame points={landmarks} width={400} height={300} scale={300} hand={hand} active={units === 'square'} title="The picture, 4:3, in square pixels" />
            <Frame points={landmarks} width={300} height={300} scale={300} hand={hand} active={units === 'mediapipe'} title="MediaPipe's numbers, drawn as if square" />
          </div>
          <p className="mt-3 text-xs leading-snug text-fg-faint">The ring is 1.4 hand lengths from the wrist, measured in each frame&apos;s units: a fingertip outside it counts as raised by the shipped rule.</p>

          <div className="mt-5 flex flex-wrap gap-1.5" role="group" aria-label="Set the hand to a sign">
            {(Object.keys(POSE_FOR) as SignLayer[]).map((layer) => (
              <button key={layer} type="button" onClick={() => preset(curlForPose(POSE_FOR[layer]))} className="how-preset" aria-label={`Make the ${layer} sign`}>
                {layer}
              </button>
            ))}
            <button type="button" onClick={() => preset(RELAXED)} className="how-preset px-3" data-testid="preset-relaxed">
              Relaxed
            </button>
            <button type="button" onClick={() => preset([0, 0, 0, 0])} className="how-preset px-3">
              Open
            </button>
          </div>

          <div className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {FINGERS.map((name, f) => (
              <Slider key={name} label={`${name} finger curled`} value={curl[f]} min={0} max={1} step={0.01} valueText={`${Math.round(curl[f] * 100)}%`} onChange={(v) => setFinger(f, v)} testId={`curl-${f}`} />
            ))}
            <Slider label="Turn in the picture" value={roll} min={-90} max={90} step={1} unit="°" onChange={setRoll} testId="roll" />
            <Slider label="Tilt toward the camera" value={pitch} min={-40} max={60} step={1} unit="°" onChange={setPitch} />
          </div>
          <div className="mt-4">
            <Choice
              label="Which hand"
              value={hand}
              onChange={setHand}
              options={[
                { value: 'Right', label: 'Right hand: clockwise' },
                { value: 'Left', label: 'Left hand: back' },
              ]}
            />
          </div>
        </div>

        <div className="grid min-w-0 gap-6 content-start">
          <div className="how-panel plastic rounded-2xl p-4 sm:p-6">
            <h3 className="font-display text-xl font-bold">The shipped reader</h3>
            <p className="mt-1 text-sm text-fg-muted">The default. A finger is raised when its tip is more than {RATIO} hand lengths from the wrist, one threshold for all four fingers.</p>
            <div className="mt-3">
              <Choice
                label="Measure in"
                value={units}
                onChange={setUnits}
                testId="units"
                options={[
                  { value: 'mediapipe', label: "MediaPipe's numbers" },
                  { value: 'square', label: 'Square pixels' },
                ]}
              />
            </div>
            <Reading bits={classicBits} hand={hand} testId="reading-classic" />
            <dl className="mt-4 grid gap-2 text-sm">
              {FINGERS.map((name, f) => (
                <div key={name} className="grid grid-cols-[4.2rem_3rem_1fr_1rem] items-center gap-2">
                  <dt className="text-fg-muted">{name}</dt>
                  <dd className="tabular-nums text-fg">{classicFeatures[f].tipRatio.toFixed(2)}</dd>
                  <dd>
                    <Gauge value={classicFeatures[f].tipRatio} min={0.8} max={2.1} marks={[RATIO]} label={`${name}: ${classicFeatures[f].tipRatio.toFixed(2)} hand lengths, threshold ${RATIO}`} />
                  </dd>
                  <dd className="text-right font-bold tabular-nums">{classicBits[f]}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="how-panel plastic rounded-2xl p-4 sm:p-6">
            <h3 className="font-display text-xl font-bold">The precise reader</h3>
            <p className="mt-1 text-sm text-fg-muted">
              Settings, Sign reading, Precise. Always square pixels. Raised: straight (reach over {M.raisedReach}) and pointing the way the palm does (align over {M.raisedAlign}).
              Folded: reach under {M.foldedReach}. Anything else is neither, and the hand makes no sign. In the app it also smooths the points first.
            </p>
            <Reading bits={preciseBits} hand={hand} testId="reading-precise" />
            <dl className="mt-4 grid gap-2 text-sm">
              <div className="grid grid-cols-[4.2rem_1fr_1fr_1rem] gap-2 text-xs text-fg-faint" aria-hidden>
                <span />
                <span>reach</span>
                <span>align</span>
                <span />
              </div>
              {FINGERS.map((name, f) => (
                <div key={name} className="grid grid-cols-[4.2rem_1fr_1fr_1rem] items-center gap-2">
                  <dt className="text-fg-muted">{name}</dt>
                  <dd>
                    <Gauge value={preciseFeatures[f].reach} min={0.5} max={1} marks={[M.raisedReach, M.foldedReach]} label={`${name} reach ${preciseFeatures[f].reach.toFixed(2)}`} />
                  </dd>
                  <dd>
                    <Gauge value={preciseFeatures[f].align} min={-0.5} max={1} marks={[M.raisedAlign]} label={`${name} align ${preciseFeatures[f].align.toFixed(2)}`} />
                  </dd>
                  <dd className="text-right font-bold tabular-nums">{preciseBits[f]}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      <div className="how-panel plastic mt-6 grid gap-6 rounded-2xl p-4 sm:p-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <h3 className="font-display text-xl font-bold">A units error, found by the model</h3>
          <p className="mt-2 max-w-xl text-fg-muted">
            MediaPipe gives x as a fraction of the picture&apos;s width and y as a fraction of its height. On a 4:3 picture those are different units, so a hand that turns is
            measured stretched. Here is the little finger, the shortest and so the closest to the line, as your hand above turns:
          </p>
          <div className="mt-4">
            <RollChart curl={curl} pitch={pitch} hand={hand} roll={roll} />
          </div>
          <p className="mt-2 flex items-center gap-2 text-sm text-fg-faint">
            <Key kind="live" /> Worked out here from the model hand you posed; the upright line marks your turn.
          </p>
        </div>
        <div className="min-w-0">
          <h4 className="font-bold">Measured on 250 model hands per angle</h4>
          <p className="mt-1 text-sm text-fg-muted">Signs read correctly by the shipped rule as the hand turns, in each unit.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm tabular-nums" data-testid="roll-study">
              <caption className="sr-only">Signs read correctly as the hand turns, from docs/research/sign-recognition.md</caption>
              <thead>
                <tr>
                  <th scope="col" className="py-1.5 pr-2 font-semibold text-fg-muted">
                    Turn
                  </th>
                  {ROLL_STUDY.angles.map((a) => (
                    <th key={a} scope="col" className={`px-1.5 py-1.5 font-semibold ${a === studyCol ? 'text-fg' : 'text-fg-muted'}`}>
                      {a}°
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(['shipped', 'square'] as const).map((k) => (
                  <tr key={k} className="border-t border-white/10">
                    <th scope="row" className="py-1.5 pr-2 font-normal text-fg-muted">
                      {k === 'shipped' ? "MediaPipe's" : 'Square'}
                    </th>
                    {ROLL_STUDY[k].map((v, i) => (
                      <td key={i} className={`px-1.5 py-1.5 ${ROLL_STUDY.angles[i] === studyCol ? 'how-col-on text-fg' : 'text-fg-muted'}`}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-5 grid gap-3 text-sm text-fg-muted">
            <li className="flex gap-2">
              <Key kind="measured" />
              <span>
                In a realistic mix of turns, tilts, jitter and finger lengths the shipped rule read <b className="text-fg">75.4%</b> of signs; in square pixels, changing nothing
                else, <b className="text-fg">89.9%</b>.
              </span>
            </li>
            <li className="flex gap-2">
              <Key kind="measured" />
              <span>
                A relaxed hand was read as a sign on <b className="text-fg">20.9%</b> of frames by the shipped rule and <b className="text-fg">0.5%</b> by the precise reader,
                which read <b className="text-fg">94.1%</b> of signs. Try the Relaxed button above.
              </span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-fg-faint">From docs/research/sign-recognition.md: 8,000 model hands, 4:3 pictures.</p>
        </div>
      </div>

      <HoldTiming curl={curl} hand={hand} />
    </Section>
  )
}
