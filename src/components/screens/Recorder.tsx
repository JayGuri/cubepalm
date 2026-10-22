import { useEffect, useRef, useState } from 'react'
import { CameraDebugOverlay } from '../CameraDebugOverlay'
import { PoseIcon } from '../HandsGuide'
import { HandFaces } from '../pages/faces'
import { useSolvedAfterMount } from '../pages/scramble'
import { PageFrame } from '../pages/PageFrame'
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
  const done = started && index >= STEPS.length
  // The camera is on only while there is something to record: at the end its light goes out.
  const gestures = useHandGestures({ enabled: started && !done, thresholds: DEFAULT_THRESHOLDS })
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

  // A shape that went wrong can be taken again. While recording, throw the clip away
  // and start this shape over; while getting ready, step back and drop the shape
  // before (the one that has just finished). Either way nothing bad stays in the file.
  const redoThis = () => {
    recordingRef.current = null
    setPhase('ready')
  }
  const backOne = () => {
    setClips((all) => all.slice(0, index - 1))
    setIndex((i) => i - 1)
  }

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
    <PageFrame>
      <h1 className="font-display mt-10 text-3xl font-extrabold tracking-tight sm:mt-12 sm:text-4xl">Record your hand signs</h1>

      {!started && (
        <>
          <p className="mt-3 text-fg-muted">
            This helps measure how well CubePalm reads hands. You will be shown {STEPS.length} hand shapes, {CLIP_LABELS.length} for each
            hand, and asked to hold each for a few seconds. It takes about {Math.round((STEPS.length * (READY_MS + RECORD_MS)) / 60_000)} minutes.
          </p>

          <section className="plastic mt-6 rounded-2xl p-4 sm:p-5" aria-labelledby="record-kept">
            <h2 id="record-kept" className="font-display text-lg font-bold">
              What is kept, and what is not
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-fg-muted marker:text-fg-faint">
              <li>What is kept: the positions of 21 points on each hand, about 25 times a second, the three answers below, and the size of the camera's picture.</li>
              <li>What is not kept: any picture or video. Nothing that shows your face, your room or who you are.</li>
              <li>Nothing is sent. At the end you get a file, and it is yours to send or delete.</li>
            </ul>
          </section>

          <h2 className="font-display mt-8 text-lg font-bold">Three quick questions</h2>
          <Question legend="The light where you are">
            {(['bright', 'dim'] as const).map((v) => (
              <Choice key={v} on={conditions.lighting === v} onClick={() => setConditions((c) => ({ ...c, lighting: v }))}>
                {v === 'bright' ? 'Bright' : 'Dim'}
              </Choice>
            ))}
          </Question>
          <Question legend="How far your hands will be from the camera">
            {(['near', 'far'] as const).map((v) => (
              <Choice key={v} on={conditions.distance === v} onClick={() => setConditions((c) => ({ ...c, distance: v }))}>
                {v === 'near' ? 'About an arm’s length' : 'Farther back'}
              </Choice>
            ))}
          </Question>
          <Question legend="This device">
            {(['phone', 'tablet', 'computer'] as const).map((v) => (
              <Choice key={v} on={conditions.device === v} onClick={() => setConditions((c) => ({ ...c, device: v }))}>
                {v === 'phone' ? 'Phone' : v === 'tablet' ? 'Tablet' : 'Laptop or desktop'}
              </Choice>
            ))}
          </Question>
          {conditions.device !== 'computer' && (
            <p className="plastic mt-5 rounded-xl p-3 text-sm text-fg-muted" data-testid="record-prop-up">
              Stand the {conditions.device} up against something first, so both hands are free and it does not move.
            </p>
          )}

          <button type="button" data-testid="record-start" className="pg-btn pg-btn-go mt-8 min-h-12 w-full px-7 text-base sm:w-auto" onClick={() => setStarted(true)}>
            I agree, start recording
          </button>
          <p className="mt-3 text-sm text-fg-faint">Your browser will ask to use the camera. The picture itself stays on this device.</p>
        </>
      )}

      {started && !done && (
        <div ref={stepRef} className="mt-8 scroll-mt-4" data-testid="record-step">
          <p className="sr-only" aria-live="polite">
            {gestures.ready && `Shape ${index + 1}, ${step.hand.toLowerCase()} hand. ${phase === 'recording' ? 'Recording, hold still.' : 'Get ready.'}`}
          </p>
          {/* How far through: the shapes as stickers, each turning to its hand's colour once recorded. */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-fg-muted">
                Shape <b className="tabular-nums text-fg">{index + 1}</b> of {STEPS.length}
              </p>
              <p className="mt-0.5 font-display text-xl font-bold" style={{ color: HAND_COLOR[step.hand] }}>
                {step.hand} hand
              </p>
            </div>
            <div role="progressbar" aria-label="Shapes recorded" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={index}>
              <HandFaces filled={index} current={index} live={recordingNow} sticker={11} gap={3} />
            </div>
          </div>

          {/* The preview takes the camera's own shape (tall on a phone held upright), so the
              skeleton drawn over it lines up, and never more than about half the screen's height.
              Its frame turns red while recording. */}
          <div
            className={`relative mx-auto mt-4 max-h-[52dvh] w-full overflow-hidden rounded-2xl border-2 bg-black transition-colors ${recordingNow ? 'border-sticker-red' : 'border-plastic'}`}
            style={{ aspectRatio: camera ? `${camera.width} / ${camera.height}` : '16 / 9', maxWidth: camera ? `calc(52dvh * ${camera.width / camera.height})` : undefined }}
          >
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={gestures.videoRef} className="h-full w-full -scale-x-100 object-cover" playsInline muted />
            <CameraDebugOverlay feed={gestures.feed} width={640} height={360} />
            {!gestures.ready && (
              <p className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-fg-muted">
                {gestures.error ? 'The camera is not on.' : 'Starting the camera. Allow it if your browser asks.'}
              </p>
            )}
          </div>

          {gestures.error && (
            <div className="plastic mt-4 rounded-2xl border-2 border-sticker-red/50 p-4 sm:p-5" role="alert" data-testid="record-camera-error">
              <p className="font-bold text-[#FF8A9A]">The camera could not start</p>
              <p className="mt-1 text-sm">{gestures.error}</p>
              <p className="mt-2 text-sm text-fg-muted">Once the camera is allowed and free, go back and press start again.</p>
              <button type="button" className="pg-btn mt-4" onClick={() => setStarted(false)}>
                Go back
              </button>
            </div>
          )}
          {/* What to show, then whether it is being recorded: side by side on a
              wide screen, stacked on a phone so neither squeezes the other. */}
          <div className="plastic mt-4 rounded-2xl p-4 sm:flex sm:items-center sm:gap-5 sm:p-5">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              {isSign(step.label) && <PoseIcon layer={step.label} hand={step.hand} size={64} />}
              <div className="min-w-0">
                <p className="font-display text-2xl font-bold leading-tight">
                  {isSign(step.label) ? `Show the sign for ${step.label}` : CLIP_PROMPT[step.label]}
                </p>
                {isSign(step.label) && <p className="mt-1 text-sm text-fg-muted">{fingerWords(step.label)}</p>}
              </div>
            </div>
            <div
              data-testid="record-phase"
              className={`sticker mt-4 rounded-xl px-4 py-3 transition-colors duration-200 sm:mt-0 sm:w-60 sm:shrink-0 ${recordingNow ? 'bg-sticker-red text-plastic' : 'bg-raised text-fg'}`}
            >
              {!gestures.ready ? (
                <p className="text-center text-sm font-bold">{gestures.error ? 'Camera off' : 'Waiting for the camera'}</p>
              ) : (
                <Countdown key={`${index}-${phase}`} ms={phase === 'recording' ? RECORD_MS : READY_MS} label={phase === 'recording' ? 'Recording, hold still' : 'Get ready'} />
              )}
            </div>
          </div>
          {gestures.ready && (phase === 'recording' || index > 0) && (
            <div className="mt-3 flex">
              <button type="button" data-testid="record-redo" className="pg-btn" onClick={phase === 'recording' ? redoThis : backOne}>
                {phase === 'recording' ? 'Redo this shape' : 'Redo the last shape'}
              </button>
            </div>
          )}
        </div>
      )}

      {done && <Finished clips={clips.length} frames={frames} canShare={canShare} onShare={share} onSave={save} onRedo={backOne} />}
    </PageFrame>
  )
}

/** The end: the two faces, scrambled a moment ago, solve, and the file is offered. */
function Finished({ clips, frames, canShare, onShare, onSave, onRedo }: { clips: number; frames: number; canShare: boolean; onShare: () => void; onSave: () => void; onRedo: () => void }) {
  const solved = useSolvedAfterMount()
  return (
    <div className="plastic mt-8 rounded-2xl p-5 sm:p-7" data-testid="record-done">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
        <HandFaces filled={solved ? STEPS.length : 0} sticker={18} gap={4} />
        <div>
          <h2 className="font-display text-2xl font-bold">Done. Thank you.</h2>
          <p className="mt-2 text-fg-muted">
            {clips} clips and {frames} frames recorded. Nothing has left this device yet. {canShare ? 'Send the file' : 'Download the file, then send it'} to whoever
            asked you, or keep it, or delete it.
          </p>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {canShare && (
          <button type="button" data-testid="record-share" className="pg-btn pg-btn-go min-h-12 px-6" onClick={onShare}>
            Send the recording
          </button>
        )}
        <button type="button" data-testid="record-download" className={`pg-btn min-h-12 px-6 ${canShare ? '' : 'pg-btn-go'}`} onClick={onSave}>
          Download the recording
        </button>
        <button type="button" data-testid="record-redo" className="pg-btn min-h-12 px-6" onClick={onRedo}>
          Redo the last shape
        </button>
      </div>
    </div>
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
        <span className="text-sm font-bold">{label}</span>
        <span className="font-display text-2xl font-extrabold leading-none tabular-nums">{Math.ceil(left / 1000)}</span>
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/25">
        <div className="h-full bg-current" style={{ width: `${(left / ms) * 100}%` }} />
      </div>
    </>
  )
}

function Question({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-5">
      <legend className="font-bold">{legend}</legend>
      {/* The answers sit together on one strip of plastic, like stickers on a face. */}
      <div className="mt-2 inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-plastic p-1">{children}</div>
    </fieldset>
  )
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`pg-btn min-h-11 px-4 text-sm ${on ? 'pg-choice-on' : 'pg-choice-off'}`}
    >
      {children}
    </button>
  )
}
