// The four fingers a sign is made of, in order from the index finger.
export const FINGER_NAMES = ['index', 'middle', 'ring', 'little'] as const

/** A hand making no sign: every finger folded. */
export const REST = [false, false, false, false]

/** A sign's pattern ("1100") as raised fingers. */
export const fingersOf = (pose: string) => pose.split('').map((c) => c === '1')
