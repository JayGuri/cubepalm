import { it } from 'vitest'
import { makeModelHand } from '../src/core/gestures/handModel'
import type { LandmarkFrame } from '../src/core/gestures/landmarks'
import { DEFAULT_ONE_EURO, LandmarkFilter } from '../src/core/gestures/oneEuro'
import { distanceReader, marginReader, squarePixels, type PoseReader } from '../src/core/gestures/poseReaders'
import { createSignState, DEFAULT_SIGN_OPTIONS, POSE_FOR, stepSigns, type SignLayer, type SignOptions } from '../src/core/gestures/signGestures'
import { TRAINED_MARGINS } from '../src/core/gestures/trainedReaders'
import { gaussian, percent, round, seeded, table, writeReport } from './report'

// A sign is not one frame: it is a hand held still long enough to mean it. This
// measures the part of the recogniser that works over time (the vote across
// frames, the hold before a turn, and optional smoothing of the landmarks) on
// generated sequences where what the hand is doing at every instant is known.
//
// It runs the app's real recogniser, stepSigns, frame by frame.

const SEED = 4242
const FRAME_MS = 40 // 25 frames a second, the rate the app tracks at
const ASPECT = 4 / 3
const TRIALS = 40
const LAYERS = Object.keys(POSE_FOR) as SignLayer[]

type Curl = [number, number, number, number]
const curlOf = (pose: string): Curl => [...pose].map((d) => (d === '1' ? 0.05 : 0.95)) as Curl
const FIST: Curl = [0.95, 0.95, 0.95, 0.95]
const lerp = (a: Curl, b: Curl, t: number): Curl => a.map((v, i) => v + (b[i] - v) * Math.min(1, Math.max(0, t))) as Curl

/** What the hand is doing at a moment: its curl, or null when the tracker has lost it. */
type Script = (timeMs: number) => Curl | null

interface Config {
  name: string
  reader: PoseReader
  smooth: boolean
  options: Partial<SignOptions>
}

interface Turn {
  layer: SignLayer
  timeMs: number
}

/** Plays a script through the recogniser and returns every turn it made. */
function play(script: Script, durationMs: number, config: Config, noise: number, random: () => number, normal: () => number): Turn[] {
  const options: SignOptions = { ...DEFAULT_SIGN_OPTIONS, ...config.options, reader: config.reader }
  const filter = config.smooth ? new LandmarkFilter(DEFAULT_ONE_EURO) : null
  let state = createSignState()
  const turns: Turn[] = []
  // A little slow drift of the whole hand, as a hand held in the air has.
  const drift = random() * 6
  for (let t = 0; t <= durationMs; t += FRAME_MS) {
    const curl = script(t)
    const frame: LandmarkFrame = { hands: [], timestampMs: t }
    if (curl) {
      const hand = makeModelHand({ curl, noise, gaussian: normal, aspect: ASPECT, roll: Math.sin(t / 900 + drift) * 6, pitch: Math.cos(t / 1300 + drift) * 6 })
      frame.hands.push(filter ? { ...hand, landmarks: filter.next(hand.landmarks, t) } : hand)
    }
    const step = stepSigns(state, frame, options)
    state = step.next
    for (const e of step.events) turns.push({ layer: e.layer, timeMs: t })
  }
  return turns
}

const median = (values: number[]) => {
  if (values.length === 0) return NaN
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

interface Result {
  /** A sign made and held: the fraction that produced exactly the one right turn. */
  correct: number
  /** ...and how long after the pose was fully formed the turn came, in ms (median). */
  delayMs: number
  /** Moving from one sign to another: unwanted turns per change (a pose passed through on the way). */
  strayPerChange: number
  /** A relaxed, half-open hand: turns per minute (there should be none). */
  idlePerMinute: number
  /** A held sign with one frame in five lost by the tracker: the fraction still turned correctly. */
  withDrops: number
}

function measure(config: Config, noise: number): Result {
  const random = seeded(SEED)
  const normal = gaussian(random)
  const FORM_MS = 200 // fingers take this long to move into a pose

  // 1. Fist, then a sign formed over FORM_MS and held, then fist again.
  let correct = 0
  const delays: number[] = []
  for (const layer of LAYERS) {
    for (let i = 0; i < TRIALS; i++) {
      const target = curlOf(POSE_FOR[layer])
      const script: Script = (t) => (t < 500 ? FIST : t < 2500 ? lerp(FIST, target, (t - 500) / FORM_MS) : lerp(target, FIST, (t - 2500) / FORM_MS))
      const turns = play(script, 3200, config, noise, random, normal)
      if (turns.length === 1 && turns[0].layer === layer) {
        correct++
        delays.push(turns[0].timeMs - (500 + FORM_MS))
      }
    }
  }

  // 2. One sign straight to another, fingers arriving 80 ms apart, so the hand
  //    passes through other poses on the way. Anything but the two is a stray.
  let stray = 0
  let changes = 0
  for (let i = 0; i < TRIALS * 4; i++) {
    const from = LAYERS[Math.floor(random() * LAYERS.length)]
    let to = LAYERS[Math.floor(random() * LAYERS.length)]
    while (to === from) to = LAYERS[Math.floor(random() * LAYERS.length)]
    const a = curlOf(POSE_FOR[from])
    const b = curlOf(POSE_FOR[to])
    const script: Script = (t) => {
      if (t < 1500) return a
      return a.map((v, f) => v + (b[f] - v) * Math.min(1, Math.max(0, (t - 1500 - f * 80) / FORM_MS))) as Curl
    }
    const turns = play(script, 3500, config, noise, random, normal)
    changes++
    stray += turns.filter((turn) => turn.layer !== from && turn.layer !== to).length
  }

  // 3. A relaxed hand: every finger about half curled, wandering slowly.
  let idleTurns = 0
  const IDLE_MS = 20_000
  for (let i = 0; i < TRIALS / 2; i++) {
    const phase = [random() * 6, random() * 6, random() * 6, random() * 6]
    const script: Script = (t) => phase.map((p, f) => 0.5 + 0.12 * Math.sin(t / (700 + f * 130) + p)) as Curl
    idleTurns += play(script, IDLE_MS, config, noise, random, normal).length
  }

  // 4. A held sign, with the tracker losing the hand on one frame in five.
  let withDrops = 0
  for (const layer of LAYERS) {
    for (let i = 0; i < TRIALS; i++) {
      const target = curlOf(POSE_FOR[layer])
      const script: Script = (t) => (t >= 300 && random() < 0.2 ? null : t < 300 ? FIST : lerp(FIST, target, (t - 300) / FORM_MS))
      const turns = play(script, 2500, config, noise, random, normal)
      if (turns.length === 1 && turns[0].layer === layer) withDrops++
    }
  }

  const trials = LAYERS.length * TRIALS
  return {
    correct: correct / trials,
    delayMs: median(delays),
    strayPerChange: stray / changes,
    idlePerMinute: idleTurns / ((TRIALS / 2) * (IDLE_MS / 60_000)),
    withDrops: withDrops / trials,
  }
}

it('temporal filtering study', () => {
  const distance = distanceReader()
  const angle: PoseReader = (l) => marginReader(TRAINED_MARGINS)(squarePixels(l, ASPECT))
  const shippedVote = { voteWindow: DEFAULT_SIGN_OPTIONS.voteWindow, votesToSelect: DEFAULT_SIGN_OPTIONS.votesToSelect }
  const noVote = { voteWindow: 1, votesToSelect: 1 }

  const row = (config: Config, noise: number) => {
    const r = measure(config, noise)
    return [config.name, percent(r.correct), Number.isNaN(r.delayMs) ? 'n/a' : `${r.delayMs} ms`, round(r.strayPerChange, 3), round(r.idlePerMinute, 2), percent(r.withDrops)]
  }
  const headers = ['Configuration', 'Held sign turned correctly', 'Delay after the pose is formed (median)', 'Stray turns per change of sign', 'Turns per minute from an idle hand', 'Correct with 1 frame in 5 lost']

  // What each part contributes, at the shipped hold time.
  const parts = (reader: PoseReader, label: string): Config[] => [
    { name: `${label}: no vote, no smoothing`, reader, smooth: false, options: noVote },
    { name: `${label}: vote ${shippedVote.votesToSelect} of ${shippedVote.voteWindow}`, reader, smooth: false, options: shippedVote },
    { name: `${label}: smoothing only`, reader, smooth: true, options: noVote },
    { name: `${label}: vote and smoothing`, reader, smooth: true, options: shippedVote },
  ]
  const ablation = (noise: number) => table(headers, [...parts(distance, 'Distance'), ...parts(angle, 'Dead zone')].map((c) => row(c, noise)))

  // The trade the hold time makes: a shorter hold is quicker and less safe.
  const holds = [150, 250, 400, 550, 700]
  const holdTable = (reader: PoseReader, noise: number) =>
    table(
      ['Hold time', ...headers.slice(1)],
      holds.map((holdMs) => {
        const r = row({ name: `${holdMs} ms`, reader, smooth: false, options: { ...shippedVote, holdMs } }, noise)
        return [`${holdMs} ms${holdMs === DEFAULT_SIGN_OPTIONS.holdMs ? ' (shipped)' : ''}`, ...r.slice(1)]
      }),
    )

  writeReport({
    name: 'temporal-filtering',
    title: 'Holding a sign: votes, smoothing and the hold time',
    summary:
      'Reading one frame correctly is not enough: a hand passes through other poses on its way to a sign, the tracker jitters, and now and then it loses the hand. The recogniser guards against these with a vote over recent frames and a hold time before a turn is made. This measures what each guard buys and what it costs in delay, and whether smoothing the landmarks first (a One-Euro filter) adds anything.',
    parameters: {
      Recogniser: '`stepSigns` in src/core/gestures/signGestures.ts, run frame by frame',
      'Frame rate': `${1000 / FRAME_MS} per second`,
      'Shipped settings': `vote ${shippedVote.votesToSelect} of ${shippedVote.voteWindow} frames, hold ${DEFAULT_SIGN_OPTIONS.holdMs} ms, lost-hand grace ${DEFAULT_SIGN_OPTIONS.dropGraceMs} ms`,
      Smoothing: `One-Euro filter on every landmark coordinate (min cut-off ${DEFAULT_ONE_EURO.minCutoff} Hz, beta ${DEFAULT_ONE_EURO.beta})`,
      Trials: `${LAYERS.length * TRIALS} held signs, ${TRIALS * 4} changes of sign, ${(TRIALS / 2) * 20} seconds of idle hand, per row`,
      Seed: SEED,
    },
    sections: [
      {
        heading: 'What is measured',
        body: [
          '- **Held sign turned correctly**: from a fist, the fingers move into a sign over 200 ms and hold it for two seconds. Correct means exactly one turn, of the right layer.',
          '- **Delay**: from the moment the pose is fully formed to the turn. This is what the player feels as lag.',
          '- **Stray turns per change of sign**: the hand goes from one held sign straight to another, each finger arriving 80 ms after the last, so it passes through other poses. Any turn that is neither of the two signs is a stray.',
          '- **Turns per minute from an idle hand**: a relaxed hand, fingers about half curled and wandering. There should be none.',
          '- **Correct with 1 frame in 5 lost**: a held sign while the tracker drops the hand at random.',
        ].join('\n'),
      },
      { heading: 'What each part contributes (jitter 2% of hand size)', body: ablation(0.02) },
      { heading: 'The same under heavy jitter (4% of hand size)', body: ablation(0.04) },
      { heading: 'Hold time, with the shipped reader and vote (jitter 2%)', body: holdTable(distance, 0.02) },
      { heading: 'Hold time, with the dead-zone reader and the shipped vote (jitter 2%)', body: holdTable(angle, 0.02) },
      {
        heading: 'A lost hand: with and without the grace period (jitter 2%)',
        body: [
          `When the tracker loses the hand for a frame, the recogniser can either count that as the sign being let go, or wait. The app waits up to ${DEFAULT_SIGN_OPTIONS.dropGraceMs} ms. Both readers, shipped vote and hold:`,
          '',
          table(headers, [
            row({ name: 'Distance: no grace', reader: distance, smooth: false, options: { ...shippedVote, dropGraceMs: 0 } }, 0.02),
            row({ name: `Distance: ${DEFAULT_SIGN_OPTIONS.dropGraceMs} ms grace (shipped)`, reader: distance, smooth: false, options: shippedVote }, 0.02),
            row({ name: 'Dead zone: no grace', reader: angle, smooth: false, options: { ...shippedVote, dropGraceMs: 0 } }, 0.02),
            row({ name: `Dead zone: ${DEFAULT_SIGN_OPTIONS.dropGraceMs} ms grace`, reader: angle, smooth: false, options: shippedVote }, 0.02),
          ]),
        ].join('\n'),
      },
      {
        heading: 'What this does and does not show',
        body: [
          '- It shows the direction and rough size of each trade: what the vote and the hold cost in delay, and what they prevent.',
          "- The sequences are scripted. People do not move their fingers at fixed speeds, and a real tracker's errors come in bursts, not as independent jitter. Hold times that look safe here should be tried on recordings before being changed in the app.",
          '- The idle hand is deliberately the hardest case for a reader with a threshold: fingers hovering at half curl.',
        ].join('\n'),
      },
    ],
  })
})
