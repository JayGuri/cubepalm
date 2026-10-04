import { useState } from 'react'

const TIPS_KEY = 'cubepalm.tips.v1'

/** A phone-sized screen, where the cube needs the room more than the tips do. */
export function onPhone(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
}

/**
 * First-visit mouse tips. They start open on a computer until dismissed (the
 * dismissal is remembered on this device) and start closed on a phone. Either
 * way a small button brings them back, and closing them again is remembered.
 */
export function useTips() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(TIPS_KEY) !== 'dismissed' && !onPhone()
    } catch {
      return !onPhone()
    }
  })
  const dismiss = () => {
    setOpen(false)
    try {
      localStorage.setItem(TIPS_KEY, 'dismissed')
    } catch {
      // Storage blocked: the tips simply come back next visit.
    }
  }
  return { open, dismiss, show: () => setOpen(true) }
}
