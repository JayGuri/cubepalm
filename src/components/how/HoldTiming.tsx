import { useMemo, useState } from 'react'
import type { Handedness } from '../../core/gestures/landmarks'
import { DEFAULT_SIGN_OPTIONS } from '../../core/gestures/signGestures'
import { FORM_MS, holdRun, ms, useWidth, type HoldFrame } from './howMath'
import { Key } from './ui'

// A held sign, run frame by frame through the app's real recogniser
// (stepSigns), drawn as a strip: the vote settling, the hold filling, the turn.

function Strip({ frames, width, formMs }: { frames: HoldFrame[]; width: number; formMs: number }) {
  const height = 64
  const x = (t: number) => (t / frames[frames.length - 1].t) * width
  const turnAt = frames.find((f) => f.turn)?.t
  return (
    <svg width={width} height={height} className="block" role="img" aria-hidden>
      <rect width={width} height={height} rx="8" className="fill-plastic" />
      <line x1={x(formMs)} x2={x(formMs)} y1="0" y2={height} className="how-threshold" />
      {frames.map((f, i) =>
        f.lost ? <rect key={i} x={x(f.t)} y="6" width={Math.max(1.5, width / frames.length)} height={height - 12} className="how-lost" /> : null,
      )}
      <path
        d={frames.map((f, i) => `${i ? 'L' : 'M'}${x(f.t).toFixed(1)},${(f.recognised ? 16 : height - 16).toFixed(1)}`).join('')}
        className="how-line-live"
        fill="none"
      />
      {turnAt !== undefined && (
        <>
          <line x1={x(turnAt)} x2={x(turnAt)} y1="0" y2={height} className="how-now" />
          <circle cx={x(turnAt)} cy={16} r="5" className="how-dot-live" />
        </>
      )}
    </svg>
  )
}

export function HoldTiming({ curl, hand }: { curl: number[]; hand: Handedness }) {
  const [lose, setLose] = useState(false)
  const [grace, setGrace] = useState(true)
  const [ref, width] = useWidth<HTMLDivElement>(560)
  const frames = useMemo(() => holdRun(curl, hand, { lose, grace, seed: 7 }), [curl, hand, lose, grace])
  const turnAt = frames.find((f) => f.turn)?.t
  const correct = Boolean(turnAt)

  return (
    <div className="how-panel plastic mt-6 rounded-2xl p-4 sm:p-6">
      <h3 className="font-display text-xl font-bold">Holding it steady</h3>
      <p className="mt-2 max-w-2xl text-fg-muted">
        One frame is never enough: the hand on the left above closes into its pose over 200&nbsp;ms, and the recogniser waits for{' '}
        {DEFAULT_SIGN_OPTIONS.votesToSelect} of the last {DEFAULT_SIGN_OPTIONS.voteWindow} frames to agree, then holds that for {DEFAULT_SIGN_OPTIONS.holdMs}&nbsp;ms before it
        turns anything. Run it below, frame by frame, through the app&apos;s real recogniser.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" aria-pressed={lose} onClick={() => setLose((v) => !v)} className="how-toggle min-h-11" data-testid="hold-lose">
          Drop 1 frame in 5 (a flaky tracker)
        </button>
        <button type="button" aria-pressed={grace} onClick={() => setGrace((v) => !v)} className="how-toggle min-h-11">
          Wait {DEFAULT_SIGN_OPTIONS.dropGraceMs} ms for a lost hand (the shipped grace period)
        </button>
      </div>
      <div ref={ref} className="mt-4">
        <Strip frames={frames} width={width} formMs={FORM_MS} />
      </div>
      <p className="mt-2 text-sm text-fg-muted" aria-live="polite" data-testid="hold-result">
        {correct ? (
          <>Turned at {ms(turnAt! - FORM_MS)} after the pose formed.</>
        ) : (
          <>No turn in two seconds: a dropped frame with no grace period restarts the hold.</>
        )}
      </p>
      <p className="mt-3 flex items-center gap-2 text-xs text-fg-faint">
        <Key kind="measured" /> Measured (docs/research/temporal-filtering.md, 2% jitter, 360 trials a row): waiting for a lost hand took a held sign with one frame in five
        dropped from <b className="text-fg">68.6%</b> correct to <b className="text-fg">97.5%</b>.
      </p>
    </div>
  )
}
