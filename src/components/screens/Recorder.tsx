import { useEffect, useRef, useState } from 'react'
import { CameraDebugOverlay } from '../CameraDebugOverlay'
import { PoseIcon } from '../HandsGuide'
import { SiteNav } from '../SiteNav'
import { DEFAULT_THRESHOLDS } from '../../core/gestures/GestureRecognizer'
import type { Handedness } from '../../core/gestures/landmarks'
import { CLIP_LABELS, CLIP_PROMPT, packFrame, type Clip, type ClipLabel, type Conditions, type Recording } from '../../core/gestures/recording'
import { HAND_COLOR, POSE_FOR, type SignLayer } from '../../core/gestures/signGestures'
import { useHandGestures } from '../../core/gestures/useHandGestures'

// Records hands making known signs, so the recogniser can be measured on real
// people. The person is told what to show, given a moment to get there, and the
// landmarks of the next few seconds are kept with that label. Only landmark
// coordinates are kept: no picture, no video, nothing that identifies anyone.
// The result is a file the person downloads and chooses whether to send.

const READY_MS = 2500
const RECORD_MS = 3000

interface Step {
  label: ClipLabel
  hand: Handedness
}

const STEPS: Step[] = (['Right', 'Left'] as const).flatMap((hand) => CLIP_LABELS.map((label) => ({ label, hand })))

const isSign = (label: ClipLabel): label is SignLayer => label in POSE_FOR

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  link.click()
  URL.revokeObjectURL(url)
}

export function Recorder() {
  const [conditions, setConditions] = useState<Conditions>({ lighting: 'bright', distance: 'near' })
  const [started, setStarted] = useState(false)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'ready' | 'recording'>('ready')
  const [clips, setClips] = useState<Clip[]>([])
  const gestures = useHandGestures({ enabled: started, thresholds: DEFAULT_THRESHOLDS })

  const done = started && index >= STEPS.length
  const step = STEPS[Math.min(index, STEPS.length - 1)]

  // The clip being filled, and when it began; frames are added outside React.
  const recordingRef = useRef<{ clip: Clip; startMs: number } | null>(null)
  useEffect(
    () =>
      gestures.feed.subscribe((frame) => {
        const recording = recordingRef.current
        if (recording) recording.clip.frames.push(packFrame(frame, recording.startMs))
      }),
    [gestures.feed],
  )

  // Get ready, record, next. The clock only runs once the camera is really on.
  useEffect(() => {
    if (!started || done || !gestures.ready) return
    if (phase === 'ready') {
      const timer = window.setTimeout(() => {
        recordingRef.current = { clip: { label: step.label, hand: step.hand, frames: [] }, startMs: performance.now() }
        setPhase('recording')
      }, READY_MS)
      return () => window.clearTimeout(timer)
    }
    const timer = window.setTimeout(() => {
      const finished = recordingRef.current
      recordingRef.current = null
      if (finished) setClips((all) => [...all, finished.clip])
      setPhase('ready')
      setIndex((i) => i + 1)
    }, RECORD_MS)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, done, gestures.ready, phase, index])

  const frames = clips.reduce((n, c) => n + c.frames.length, 0)
  const save = () => {
    const recording: Recording = { version: 1, recordedAt: new Date().toISOString(), conditions, clips }
    download(`cubepalm-hands-${recording.recordedAt.slice(0, 19).replace(/[:T]/g, '-')}.json`, JSON.stringify(recording))
  }

  return (
    <main className="min-h-dvh bg-[#16171B] px-6 py-12 text-[#ECEAE4]">
      <div className="mx-auto max-w-2xl">
        <SiteNav size={40} />
        <h1 className="font-display mt-10 text-4xl font-extrabold tracking-tight">Record your hand signs</h1>

        {!started && (
          <>
            <p className="mt-3 text-[#9C9AA3]">
              This helps measure how well CubePalm reads hands. You will be shown {STEPS.length} hand shapes, {CLIP_LABELS.length} for
              each hand, and asked to hold each for a few seconds. It takes about {Math.round((STEPS.length * (READY_MS + RECORD_MS)) / 60_000)} minutes.
            </p>
            <ul className="mt-5 list-disc space-y-1.5 pl-5 text-sm text-[#B2B0B9]">
              <li>What is kept: the positions of 21 points on each hand, about 25 times a second, and the two answers below.</li>
              <li>What is not kept: any picture or video. Nothing that shows your face, your room or who you are.</li>
              <li>Nothing is sent. At the end you get a file, and it is yours to send or delete.</li>
            </ul>

            <fieldset className="mt-8">
              <legend className="font-medium">The light where you are</legend>
              <div className="mt-2 flex gap-2">
                {(['bright', 'dim'] as const).map((v) => (
                  <Choice key={v} on={conditions.lighting === v} onClick={() => setConditions((c) => ({ ...c, lighting: v }))}>
                    {v === 'bright' ? 'Bright' : 'Dim'}
                  </Choice>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-5">
              <legend className="font-medium">How far your hands will be from the camera</legend>
              <div className="mt-2 flex gap-2">
                {(['near', 'far'] as const).map((v) => (
                  <Choice key={v} on={conditions.distance === v} onClick={() => setConditions((c) => ({ ...c, distance: v }))}>
                    {v === 'near' ? 'About an arm’s length' : 'Farther back'}
                  </Choice>
                ))}
              </div>
            </fieldset>

            <button
              type="button"
              data-testid="record-start"
              className="mt-8 rounded-full bg-[#FFD500] px-7 py-3 font-semibold text-[#16171B] hover:bg-[#FFE04D]"
              onClick={() => setStarted(true)}
            >
              I agree, start recording
            </button>
          </>
        )}

        {started && !done && (
          <div className="mt-8" data-testid="record-step">
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={gestures.videoRef} className="h-full w-full -scale-x-100 object-cover" playsInline muted />
              <CameraDebugOverlay feed={gestures.feed} width={640} height={360} />
              {!gestures.ready && !gestures.error && (
                <p className="absolute inset-0 grid place-items-center text-sm text-[#9C9AA3]">Starting the camera. Allow it if your browser asks.</p>
              )}
            </div>
            {gestures.error && <p className="mt-3 text-sm text-[#FF8A9A]">{gestures.error}</p>}

            <div className="mt-5 flex items-center gap-4 rounded-2xl border border-white/10 bg-[#202227] p-5">
              {isSign(step.label) && <PoseIcon layer={step.label} hand={step.hand} size={44} />}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[#9C9AA3]">
                  {index + 1} of {STEPS.length}, <b style={{ color: HAND_COLOR[step.hand] }}>{step.hand.toLowerCase()} hand</b>
                </p>
                <p className="font-display text-2xl font-bold">{isSign(step.label) ? `Show the sign for ${step.label}` : CLIP_PROMPT[step.label]}</p>
              </div>
              <span
                data-testid="record-phase"
                className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${phase === 'recording' && gestures.ready ? 'bg-[#E5384F] text-white' : 'bg-white/10 text-[#9C9AA3]'}`}
              >
                {!gestures.ready ? 'Waiting' : phase === 'recording' ? 'Recording, hold still' : 'Get ready'}
              </span>
            </div>
          </div>
        )}

        {done && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-[#202227] p-6" data-testid="record-done">
            <p className="font-display text-2xl font-bold">Done. Thank you.</p>
            <p className="mt-2 text-[#9C9AA3]">
              {clips.length} clips and {frames} frames recorded. Download the file, then send it to whoever asked you, or keep it, or delete it.
            </p>
            <button type="button" data-testid="record-download" className="mt-5 rounded-full bg-[#FFD500] px-6 py-2.5 font-semibold text-[#16171B] hover:bg-[#FFE04D]" onClick={save}>
              Download the recording
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm transition ${on ? 'bg-[#4CC9F0] font-semibold text-[#16171B]' : 'border border-white/15 text-[#9C9AA3] hover:text-[#ECEAE4]'}`}
    >
      {children}
    </button>
  )
}
