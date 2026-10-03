import { create } from 'zustand'

// App-wide settings, persisted in localStorage.

export type InputModePreference = 'mouse' | 'hands'

export interface SettingsState {
  colorblindPalette: boolean
  defaultInputMode: InputModePreference
  swapHands: boolean
  setColorblindPalette: (on: boolean) => void
  setDefaultInputMode: (mode: InputModePreference) => void
  setSwapHands: (on: boolean) => void
}

const STORAGE_KEY = 'palmtwist.settings.v1'

interface StoredSettings {
  colorblindPalette: boolean
  defaultInputMode: InputModePreference
  swapHands: boolean
}

const DEFAULTS: StoredSettings = {
  colorblindPalette: false,
  defaultInputMode: 'mouse',
  swapHands: false,
}

/** Keeps each stored value only if it is one the app understands; anything else falls back to its default. */
export function sanitize(stored: unknown): StoredSettings {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Record<string, unknown>
  return {
    colorblindPalette: typeof s.colorblindPalette === 'boolean' ? s.colorblindPalette : DEFAULTS.colorblindPalette,
    defaultInputMode: s.defaultInputMode === 'mouse' || s.defaultInputMode === 'hands' ? s.defaultInputMode : DEFAULTS.defaultInputMode,
    swapHands: typeof s.swapHands === 'boolean' ? s.swapHands : DEFAULTS.swapHands,
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
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
}))
