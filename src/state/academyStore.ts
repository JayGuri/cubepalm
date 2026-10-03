import { create } from 'zustand'

// Which Academy lessons this learner has finished, remembered on this device.

const STORAGE_KEY = 'cubepalm.academy.v1'

function load(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function save(done: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(done))
  } catch {
    // Storage blocked or full: progress just won't be remembered.
  }
}

interface AcademyStore {
  completed: string[]
  complete: (lessonId: string) => void
  reset: () => void
}

export const useAcademyStore = create<AcademyStore>((set, get) => ({
  completed: load(),
  complete: (lessonId) => {
    if (get().completed.includes(lessonId)) return
    const completed = [...get().completed, lessonId]
    save(completed)
    set({ completed })
  },
  reset: () => {
    save([])
    set({ completed: [] })
  },
}))
