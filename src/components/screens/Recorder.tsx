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
  // The device is guessed from the screen (a touch screen under 700 pixels wide
  // is a phone) and can be corrected: cameras differ, and that is worth comparing.
  const [conditions, setConditions] = useState<Conditions>(() => {
    const touch = window.matchMedia('(pointer: coarse)').matches
    return { lighting: 'bright', distance: 'near', device: !touch ? 'computer' : Math.min(window.innerWidth, window.innerHeight) < 700 ? 'phone' : 'tablet' }
  })
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

  // The camera picture's size, noted once it is running (a phone held upright gives a tall picture).
  const [camera, setCamera] = useState<Recording['camera']>(null)
  useEffect(() => {
    const video = gestures.videoRef.current
    if (!gestures.ready || !video) return
    // The size is known once the first frame has arrived.
    const note = () => {
      if (video.videoWidth > 0) setCamera({ width: video.videoWidth, height: video.videoHeight })
    }
    note()
    video.addEventListener('loadedmetadata', note)
    return () => video.removeEventListener('loadedmetadata', note)
  }, [gestures.ready, gestures.videoRef])

  const frames = clips.reduce((n, c) => n + c.frames.length, 0)
  const build = () => {
    const recording: Recording = { version: 1, recordedAt: new Date().toISOString(), conditions, camera, clips }
    const name = `cubepalm-hands-${conditions.device}-${conditions.lighting}-${recording.recordedAt.slice(0, 19).replace(/[:T]/g, '-')}.json`
    return { name, text: JSON.stringify(recording) }
  }
  const save = () => {
    const { name, text } = build()
    download(name, text)
  }
  // On a phone a downloaded file is hard to find again; handing it straight to
  // a messaging or mail app is easier. Offered only where the browser can do it.
  const shareFile = () => {
    const { name, text } = build()
    return new File([text], name, { type: 'application/json' })
  }
  const [canShare] = useState(() => {
    try {
      return typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] })
    } catch {
      return false
    }
  })
  const share = () => void navigator.share({ files: [shareFile()], title: 'CubePalm hand recording' }).catch(() => undefined)

  // Once started, bring the camera and the prompt to the top of the screen so a
  // propped-up phone shows both without anyone touching it.
  const stepRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (started) stepRef.current?.scrollIntoView({ block: 'start' })
  }, [started])

  const recordingNow = phase === 'recording' && gestures.ready

  return (
    <main className="min-h-dvh bg-[#16171B] px-4 py-8 text-[#ECEAE4] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <SiteNav size={40} />
        <h1 className="font-display mt-8 text-3xl font-extrabold tracking-tight sm:mt-10 sm:text-4xl">Record your hand signs</h1>

        {!started && (
          <>
            <p className="mt-3 text-[#B2B0B9]">
              This helps measure how well CubePalm reads hands. You will be shown {STEPS.length} hand shapes, {CLIP_LABELS.length} for
              each hand, and asked to hold each for a few seconds. It takes about {Math.round((STEPS.length * (READY_MS + RECORD_MS)) / 60_000)} minutes.
            </p>

            <section className="mt-6 rounded-2xl border border-white/10 bg-[#202227] p-4 sm:p-5" aria-labelledby="record-kept">
              <h2 id="record-kept" className="font-display text-lg font-bold">
                What is kept, and what is not
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#B2B0B9]">
                <li>What is kept: the positions of 21 points on each hand, about 25 times a second, the three answers below, and the size of the camera's picture.</li>
                <li>What is not kept: any picture or video. Nothing that shows your face, your room or who you are.</li>
                <li>Nothing is sent. At the end you get a file, and it is yours to send or delete.</li>
              </ul>
            </section>

            <h2 className="font-display mt-8 text-lg font-bold">Three quick questions</h2>
            <fieldset className="mt-3">
              <legend className="font-medium">The light where you are</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {(['bright', 'dim'] as const).map((v) => (
                  <Choice key={v} on={conditions.lighting === v} onClick={() => setConditions((c) => ({ ...c, lighting: v }))}>
                    {v === 'bright' ? 'Bright' : 'Dim'}
                  </Choice>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-5">
              <legend className="font-medium">How far your hands will be from the camera</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {(['near', 'far'] as const).map((v) => (
                  <Choice key={v} on={conditions.distance === v} onClick={() => setConditions((c) => ({ ...c, distance: v }))}>
                    {v === 'near' ? 'About an arm’s length' : 'Farther back'}
                  </Choice>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-5">
              <legend className="font-medium">This device</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {(['phone', 'tablet', 'computer'] as const).map((v) => (
                  <Choice key={v} on={conditions.device === v} onClick={() => setConditions((c) => ({ ...c, device: v }))}>
                    {v === 'phone' ? 'Phone' : v === 'tablet' ? 'Tablet' : 'Laptop or desktop'}
                  </Choice>
                ))}
              </div>
            </fieldset>
            {conditions.device !== 'computer' && (
              <p className="mt-5 rounded-xl border border-white/10 bg-[#202227] p-3 text-sm text-[#B2B0B9]" data-testid="record-prop-up">
                Stand the {conditions.device} up against something first, so both hands are free and it does not move.
              </p>
            )}

            <button
              type="button"
              data-testid="record-start"
              className="mt-8 min-h-12 w-full rounded-full bg-[#FFD500] px-7 font-semibold text-[#16171B] hover:bg-[#FFE04D] sm:w-auto"
              onClick={() => setStarted(true)}
            >
              I agree, start recording
            </button>
            <p className="mt-3 text-sm text-[#9C9AA3]">Your browser will ask to use the camera. The picture itself stays on this device.</p>
          </>
        )}

        {started && !done && (
          <div ref={stepRef} className="mt-8 scroll-mt-4" data-testid="record-step">
            <p className="sr-only" aria-live="polite">
              {gestures.ready && `Shape ${index + 1}, ${step.hand.toLowerCase()} hand. ${phase === 'recording' ? 'Recording, hold still.' : 'Get ready.'}`}
            </p>
            {/* How far through: a count and a thin bar across all the shapes. */}
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <p className="text-[#B2B0B9]">
                Shape <b className="tabular-nums text-[#ECEAE4]">{index + 1}</b> of {STEPS.length}
              </p>
              <p className="font-semibold" style={{ color: HAND_COLOR[step.hand] }}>
                {step.hand} hand
              </p>
            </div>
            <div
              role="progressbar"
              aria-label="Shapes recorded"
              aria-valuemin={0}
              aria-valuemax={STEPS.length}
              aria-valuenow={index}
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
            >
              <div className="h-full rounded-full bg-[#FFD500] transition-[width] duration-300" style={{ width: `${(index / STEPS.length) * 100}%` }} />
            </div>

            {/* The preview takes the camera's own shape (tall on a phone held upright), so the
                skeleton drawn over it lines up, and never more than about half the screen's height.
                Its frame turns red while recording. */}
            <div
              className={`relative mx-auto mt-4 max-h-[52dvh] w-full overflow-hidden rounded-2xl border-2 bg-black transition-colors ${recordingNow ? 'border-[#F0566B]' : 'border-white/10'}`}
              style={{ aspectRatio: camera ? `${camera.width} / ${camera.height}` : '16 / 9', maxWidth: camera ? `calc(52dvh * ${camera.width / camera.height})` : undefined }}
            >
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={gestures.videoRef} className="h-full w-full -scale-x-100 object-cover" playsInline muted />
              <CameraDebugOverlay feed={gestures.feed} width={640} height={360} />
              {!gestures.ready && (
                <p className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-[#B2B0B9]">
                  {gestures.error ? 'The camera is not on.' : 'Starting the camera. Allow it if your browser asks.'}
                </p>
              )}
            </div>

            {gestures.error && (
              <div className="mt-4 rounded-2xl border-2 border-[#F0566B]/50 bg-[#202227] p-4 sm:p-5" role="alert" data-testid="record-camera-error">
                <p className="font-semibold text-[#FF8A9A]">The camera could not start</p>
                <p className="mt-1 text-sm text-[#ECEAE4]">{gestures.error}</p>
                <p className="mt-2 text-sm text-[#B2B0B9]">Once the camera is allowed and free, go back and press start again.</p>
                <button
                  type="button"
                  className="mt-4 min-h-10 rounded-full border border-white/20 px-5 text-sm font-semibold hover:border-white/50 pointer-coarse:min-h-11"
                  onClick={() => setStarted(false)}
                >
                  Go back
                </button>
              </div>
            )}
            {/* What to show, then whether it is being recorded: side by side on a
                wide screen, stacked on a phone so neither squeezes the other. */}
            <div
              className={`mt-4 rounded-2xl border-2 bg-[#202227] p-4 transition-colors sm:flex sm:items-center sm:gap-5 sm:p-5 ${recordingNow ? 'border-[#F0566B]' : 'border-white/10'}`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-4">
                {isSign(step.label) && <PoseIcon layer={step.label} hand={step.hand} size={64} />}
                <div className="min-w-0">
                  <p className="font-display text-2xl font-bold leading-tight">
                    {isSign(step.label) ? `Show the sign for ${step.label}` : CLIP_PROMPT[step.label]}
                  </p>
                  {isSign(step.label) && <p className="mt-1 text-sm text-[#B2B0B9]">{fingerWords(step.label)}</p>}
                </div>
              </div>
              <div
                data-testid="record-phase"
                className={`mt-4 rounded-xl px-4 py-2.5 sm:mt-0 sm:w-60 sm:shrink-0 ${recordingNow ? 'bg-[#F0566B] text-[#16171B]' : 'bg-white/10 text-[#ECEAE4]'}`}
              >
                {!gestures.ready ? (
                  <p className="text-center text-sm font-semibold">{gestures.error ? 'Camera off' : 'Waiting for the camera'}</p>
                ) : (
                  <Countdown
                    key={`${index}-${phase}`}
                    ms={phase === 'recording' ? RECORD_MS : READY_MS}
                    label={phase === 'recording' ? 'Recording, hold still' : 'Get ready'}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {done && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-[#202227] p-5 sm:p-6" data-testid="record-done">
            <div className="h-1.5 rounded-full bg-[#2FB36B]" aria-hidden />
            <p className="font-display mt-5 text-2xl font-bold">Done. Thank you.</p>
            <p className="mt-2 text-[#B2B0B9]">
              {clips.length} clips and {frames} frames recorded. Nothing has left this device yet. {canShare ? 'Send the file' : 'Download the file, then send it'} to
              whoever asked you, or keep it, or delete it.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {canShare && (
                <button type="button" data-testid="record-share" className="min-h-12 rounded-full bg-[#FFD500] px-6 font-semibold text-[#16171B] hover:bg-[#FFE04D]" onClick={share}>
                  Send the recording
                </button>
              )}
              <button
                type="button"
                data-testid="record-download"
                className={`min-h-12 rounded-full px-6 font-semibold ${canShare ? 'border border-white/20 hover:border-white/50' : 'bg-[#FFD500] text-[#16171B] hover:bg-[#FFE04D]'}`}
                onClick={save}
              >
                Download the recording
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

const FINGER_NAMES = ['index', 'middle', 'ring', 'little']

/** "Index and middle fingers up, the others folded": the sign in words, for someone who has never seen it. */
function fingerWords(layer: SignLayer): string {
  const up = FINGER_NAMES.filter((_, i) => POSE_FOR[layer][i] === '1')
  const names = up.length === 1 ? up[0] : `${up.slice(0, -1).join(', ')} and ${up[up.length - 1]}`
  return `${names[0].toUpperCase()}${names.slice(1)} finger${up.length > 1 ? 's' : ''} up, the others folded`
}

/** The seconds left in this part, as a number and a bar that empties. Remounted (by key) for each part. */
function Countdown({ ms, label }: { ms: number; label: string }) {
  const [start] = useState(() => performance.now())
  const [now, setNow] = useState(start)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 100)
    return () => window.clearInterval(timer)
  }, [])
  const left = Math.max(0, ms - (now - start))
  return (
    <>
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <span className="font-display text-2xl font-extrabold leading-none tabular-nums">{Math.ceil(left / 1000)}</span>
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/20">
        <div className="h-full bg-current" style={{ width: `${(left / ms) * 100}%` }} />
      </div>
    </>
  )
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-10 rounded-full px-4 text-sm transition-colors pointer-coarse:min-h-11 ${on ? 'bg-[#4CC9F0] font-semibold text-[#16171B]' : 'border border-white/15 text-[#B2B0B9] hover:border-white/40 hover:text-[#ECEAE4]'}`}
    >
      {children}
    </button>
  )
}
