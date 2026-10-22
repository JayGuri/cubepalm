import { useSettingsStore } from '../../state/settingsStore'

// What a turn feels like when it lands: a soft plastic click, like the detent of
// a real cube catching the layer, and a tap of the phone's vibration motor. Both
// are off unless Settings turns them on (turnSound, haptics).
//
// The click is synthesised, not a recording: a few milliseconds of noise through
// a band-pass filter (the bright "tk" of plastic) over a short, lower resonance
// (the body of the cube), then a fainter second contact a few milliseconds later,
// the detent's ball settling. Pitch and level vary a little every time, so a run
// of turns never sounds like a machine gun.

/** Clicks closer together than this are dropped: at 4x playback, roughly every other turn clicks. */
const MIN_CLICK_GAP_MS = 70
/** Taps closer together than this are dropped: a vibration motor cannot render faster ones anyway. */
const MIN_TAP_GAP_MS = 110
/** Turns landing faster than this are a run (a scramble being dealt, a solution playing back). */
const RUN_GAP_MS = 320
const PEAK = 0.22 // never louder than gentle

/**
 * How loud a click is, 0 to 1, given the time since the last one, or 0 to drop it.
 * A run of back-to-back turns (a scramble being dealt) ratchets softly instead of
 * repeating the full click.
 */
export function clickLevel(sinceLastMs: number): number {
  if (sinceLastMs < MIN_CLICK_GAP_MS) return 0
  if (sinceLastMs >= RUN_GAP_MS) return 1
  return 0.55 + 0.25 * ((sinceLastMs - MIN_CLICK_GAP_MS) / (RUN_GAP_MS - MIN_CLICK_GAP_MS))
}

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null
let lastClick = -Infinity
let lastTap = -Infinity
let idleTimer: number | undefined

function audio(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = typeof window === 'undefined' ? undefined : window.AudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor({ latencyHint: 'interactive' })
  } catch {
    return null
  }
  noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.06), ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return ctx
}

// Browsers only let sound start from a click or a key press. The context is made
// (or woken) inside one, once the setting is on; the click itself plays later,
// when the turn lands. It sleeps again after a quiet spell, to spare the battery.
function unlock() {
  if (!useSettingsStore.getState().turnSound) return
  const c = audio()
  if (c && c.state !== 'running') void c.resume().catch(() => {})
}
if (typeof window !== 'undefined') {
  for (const type of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(type, unlock, { capture: true, passive: true })
}

function burst(c: AudioContext, at: number, freq: number, q: number, gain: number, decay: number) {
  const src = c.createBufferSource()
  src.buffer = noise
  src.playbackRate.value = 0.9 + Math.random() * 0.2
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = freq
  filter.Q.value = q
  const env = c.createGain()
  env.gain.setValueAtTime(0, at)
  env.gain.linearRampToValueAtTime(gain, at + 0.0008)
  env.gain.setTargetAtTime(0, at + 0.0008, decay)
  src.connect(filter).connect(env).connect(c.destination)
  src.start(at, Math.random() * 0.02, 0.05)
}

function click(level: number) {
  const c = audio()
  if (!c || !noise) return
  if (c.state !== 'running') {
    // Woken outside a gesture: fine where the browser allows it, skipped where it does not.
    void c.resume().catch(() => {})
    return
  }
  const pitch = 2 ** ((Math.random() - 0.5) * 0.12) // about a semitone of spread in all
  const g = PEAK * level * (0.88 + Math.random() * 0.24)
  const t = c.currentTime + 0.004
  burst(c, t, 3100 * pitch, 1.6, g, 0.0045) // the bright tick
  burst(c, t, 900 * pitch, 4, g * 0.55, 0.009) // the plastic body
  burst(c, t + 0.006 + Math.random() * 0.004, 4200 * pitch, 2.2, g * 0.3, 0.003) // the detent settling
  window.clearTimeout(idleTimer)
  idleTimer = window.setTimeout(() => void ctx?.suspend().catch(() => {}), 20_000)
}

/** A layer has just snapped into place. Plays whatever the settings ask for. */
export function turnLanded(now = performance.now()) {
  const { turnSound, haptics } = useSettingsStore.getState()
  if (turnSound) {
    const level = clickLevel(now - lastClick)
    if (level > 0) {
      lastClick = now
      click(level)
    }
  }
  if (haptics && now - lastTap >= MIN_TAP_GAP_MS && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    lastTap = now
    try {
      navigator.vibrate(10)
    } catch {
      // Blocked before the first interaction with the page; nothing to do.
    }
  }
}
