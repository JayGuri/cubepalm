import { create } from 'zustand'

// App-wide settings, persisted in localStorage.

export type InputModePreference = 'mouse' | 'hands'
export type TurnSpeed = 'slow' | 'normal' | 'fast'
/** How a hand sign is read: the original rule, or the pipeline from docs/research/sign-recognition.md. */
export type SignReading = 'classic' | 'precise'

/** How long one quarter turn takes to draw, in milliseconds. */
export const TURN_MS: Record<TurnSpeed, number> = { slow: 340, normal: 220, fast: 130 }

export interface SettingsState {
  colorblindPalette: boolean
  defaultInputMode: InputModePreference
  swapHands: boolean
  turnSpeed: TurnSpeed
  signReading: SignReading
  /** A soft click as each layer lands, like the detent of a real cube. */
  turnSound: boolean
  /** A short tap of the phone's vibration motor as each layer lands, where the phone has one. */
  haptics: boolean
  setColorblindPalette: (on: boolean) => void
  setDefaultInputMode: (mode: InputModePreference) => void
  setSwapHands: (on: boolean) => void
  setTurnSpeed: (speed: TurnSpeed) => void
  setSignReading: (reading: SignReading) => void
  setTurnSound: (on: boolean) => void
  setHaptics: (on: boolean) => void
}

const STORAGE_KEY = 'cubepalm.settings.v1'

interface StoredSettings {
  colorblindPalette: boolean
  defaultInputMode: InputModePreference
  swapHands: boolean
  turnSpeed: TurnSpeed
  signReading: SignReading
  turnSound: boolean
  haptics: boolean
}

const DEFAULTS: StoredSettings = {
  colorblindPalette: false,
  defaultInputMode: 'mouse',
  swapHands: false,
  turnSpeed: 'normal',
  signReading: 'classic',
  turnSound: false,
  haptics: false,
}

/** Keeps each stored value only if it is one the app understands; anything else falls back to its default. */
export function sanitize(stored: unknown): StoredSettings {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Record<string, unknown>
  return {
    colorblindPalette: typeof s.colorblindPalette === 'boolean' ? s.colorblindPalette : DEFAULTS.colorblindPalette,
    defaultInputMode: s.defaultInputMode === 'mouse' || s.defaultInputMode === 'hands' ? s.defaultInputMode : DEFAULTS.defaultInputMode,
    swapHands: typeof s.swapHands === 'boolean' ? s.swapHands : DEFAULTS.swapHands,
    turnSpeed: s.turnSpeed === 'slow' || s.turnSpeed === 'normal' || s.turnSpeed === 'fast' ? s.turnSpeed : DEFAULTS.turnSpeed,
    signReading: s.signReading === 'classic' || s.signReading === 'precise' ? s.signReading : DEFAULTS.signReading,
    turnSound: typeof s.turnSound === 'boolean' ? s.turnSound : DEFAULTS.turnSound,
    haptics: typeof s.haptics === 'boolean' ? s.haptics : DEFAULTS.haptics,
  }
}

function load(): StoredSettings {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return sanitize(JSON.parse(raw))
  } catch {
    return DEFAULTS
  }
}

function persist(settings: StoredSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitize(settings)))
  } catch {
    // A full or blocked storage quota must not break the app.
  }
}

const initial = load()

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...initial,
  setColorblindPalette: (on) => {
    persist({ ...get(), colorblindPalette: on })
    set({ colorblindPalette: on })
  },
  setDefaultInputMode: (mode) => {
    persist({ ...get(), defaultInputMode: mode })
    set({ defaultInputMode: mode })
  },
  setSwapHands: (on) => {
    persist({ ...get(), swapHands: on })
    set({ swapHands: on })
  },
  setTurnSpeed: (speed) => {
    persist({ ...get(), turnSpeed: speed })
    set({ turnSpeed: speed })
  },
  setSignReading: (reading) => {
    persist({ ...get(), signReading: reading })
    set({ signReading: reading })
  },
  setTurnSound: (on) => {
    persist({ ...get(), turnSound: on })
    set({ turnSound: on })
  },
  setHaptics: (on) => {
    persist({ ...get(), haptics: on })
    set({ haptics: on })
  },
}))
