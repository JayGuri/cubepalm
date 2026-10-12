import type { Handedness, Landmark, LandmarkFrame } from './landmarks'
import { POSE_FOR, type SignLayer } from './signGestures'

// A recording of real hands making known signs, for measuring the recogniser on
// people instead of on a model (research/sign-recognition.study.ts reads these).
//
// It holds landmark coordinates only: 21 points per hand per frame. No picture
// or video is ever stored, so a recording cannot show who made it.

/** What the person was asked to do: one of the nine signs, or one of three hands that are not a sign. */
export type ClipLabel = SignLayer | 'relaxed' | 'open' | 'fist'

export const CLIP_LABELS: ClipLabel[] = [...(Object.keys(POSE_FOR) as SignLayer[]), 'relaxed', 'open', 'fist']

export const CLIP_PROMPT: Record<'relaxed' | 'open' | 'fist', string> = {
  relaxed: 'Relax your hand, fingers loosely half curled',
  open: 'Open hand, all four fingers up',
  fist: 'Make a fist',
}

/**
 * The pose a clip should be read as, four digits with the index finger first.
 * A relaxed hand has no right pose, only a wrong outcome (being read as a
 * sign), so it has none.
 */
export function expectedPose(label: ClipLabel): string | null {
  if (label === 'relaxed') return null
  if (label === 'open') return '1111'
  if (label === 'fist') return '0000'
  return POSE_FOR[label]
}

export interface RecordedHand {
  handedness: Handedness
  score: number
  /** 21 landmarks as x, y, z, x, y, z, ... (63 numbers), rounded to four decimals. */
  points: number[]
}

export interface RecordedFrame {
  /** Milliseconds since the clip began. */
  t: number
  /** Width over height of the camera picture, when known. */
  aspect: number | null
  hands: RecordedHand[]
}

export interface Clip {
  label: ClipLabel
  /** The hand the person was asked to use. */
  hand: Handedness
  frames: RecordedFrame[]
}

export type DeviceKind = 'phone' | 'tablet' | 'computer'

export interface Conditions {
  lighting: 'bright' | 'dim'
  distance: 'near' | 'far'
  /** What the camera belongs to. Cameras differ in picture shape and sharpness, so this is worth comparing. */
  device: DeviceKind
}

export interface Recording {
  version: 1
  /** ISO date and time. */
  recordedAt: string
  conditions: Conditions
  /** The camera picture's size in pixels, when known (a phone held upright gives a tall one). */
  camera: { width: number; height: number } | null
  clips: Clip[]
}

const round4 = (v: number) => Math.round(v * 10_000) / 10_000

/** One camera frame, packed for a recording. */
export function packFrame(frame: LandmarkFrame, clipStartMs: number): RecordedFrame {
  return {
    t: Math.round(frame.timestampMs - clipStartMs),
    aspect: frame.aspect ? round4(frame.aspect) : null,
    hands: frame.hands.map((hand) => ({
      handedness: hand.handedness,
      score: round4(hand.score),
      points: hand.landmarks.flatMap((p) => [round4(p.x), round4(p.y), round4(p.z)]),
    })),
  }
}

/** A recorded hand's landmarks, as the recogniser takes them. */
export function unpackPoints(points: number[]): Landmark[] {
  return Array.from({ length: 21 }, (_, i) => ({ x: points[i * 3], y: points[i * 3 + 1], z: points[i * 3 + 2] }))
}

const isHand = (v: unknown): v is Handedness => v === 'Left' || v === 'Right'

/** A recording read back from a file: checked, with anything malformed dropped. Null if it is not a recording at all. */
export function parseRecording(data: unknown): Recording | null {
  const d = data as Partial<Recording> | null
  if (!d || typeof d !== 'object' || d.version !== 1 || !Array.isArray(d.clips)) return null
  const clips: Clip[] = []
  for (const clip of d.clips as Array<Partial<Clip>>) {
    if (!clip || !CLIP_LABELS.includes(clip.label as ClipLabel) || !isHand(clip.hand) || !Array.isArray(clip.frames)) continue
    const frames = (clip.frames as Array<Partial<RecordedFrame>>).flatMap((f) => {
      if (!f || typeof f.t !== 'number' || !Array.isArray(f.hands)) return []
      const hands = (f.hands as Array<Partial<RecordedHand>>).filter(
        (h): h is RecordedHand =>
          Boolean(h) && isHand(h.handedness) && typeof h.score === 'number' && Array.isArray(h.points) && h.points.length === 63 && h.points.every((n) => Number.isFinite(n)),
      )
      return [{ t: f.t, aspect: typeof f.aspect === 'number' && f.aspect > 0 ? f.aspect : null, hands }]
    })
    clips.push({ label: clip.label as ClipLabel, hand: clip.hand, frames })
  }
  const c = d.conditions as Partial<Conditions> | undefined
  const cam = d.camera as { width?: unknown; height?: unknown } | null | undefined
  return {
    version: 1,
    recordedAt: typeof d.recordedAt === 'string' ? d.recordedAt : '',
    conditions: {
      lighting: c?.lighting === 'dim' ? 'dim' : 'bright',
      distance: c?.distance === 'far' ? 'far' : 'near',
      device: c?.device === 'phone' || c?.device === 'tablet' ? c.device : 'computer',
    },
    camera: cam && typeof cam.width === 'number' && typeof cam.height === 'number' && cam.width > 0 && cam.height > 0 ? { width: cam.width, height: cam.height } : null,
    clips,
  }
}
