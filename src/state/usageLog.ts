// A record, on this device only, of how the cube was turned: by dragging, by
// keys, by the on-screen buttons or by hand signs. It exists to answer one
// question with numbers instead of impressions: how do the input methods
// compare, in speed and in mistakes? Nothing here is sent anywhere. It can be
// seen at /stats, downloaded as a file, and cleared.

export type InputMethod = 'drag' | 'keys' | 'buttons' | 'hands'
export const INPUT_METHODS: InputMethod[] = ['drag', 'keys', 'buttons', 'hands']
export const METHOD_NAME: Record<InputMethod, string> = { drag: 'Dragging', keys: 'Keyboard', buttons: 'Turn buttons', hands: 'Hand signs' }

/** One turn of a layer by the player. */
export interface TurnEvent {
  k: 'turn'
  /** When, in milliseconds since 1970. */
  at: number
  m: InputMethod
  /** Milliseconds since the player's previous turn in the same attempt; null for the first. */
  gap: number | null
  /** With the guide showing: did the turn follow it ('on') or not ('off')? 'none' when no guide was up. */
  g: 'on' | 'off' | 'none'
}

/** One press of Undo. */
export interface UndoEvent {
  k: 'undo'
  at: number
}

/** A scrambled cube brought back to solved. */
export interface SolveEvent {
  k: 'solve'
  at: number
  /** First turn to solved, in milliseconds. */
  ms: number
  /** Quarter turns made. */
  moves: number
  /** The method most of the turns were made with. */
  m: InputMethod
  /** The guide or "Solve for me" was used. */
  help: boolean
  /** A random scramble, not one the player chose. */
  ranked: boolean
}

export type UsageEvent = TurnEvent | UndoEvent | SolveEvent

const STORAGE_KEY = 'cubepalm.usage.v1'
// About a megabyte at most; the oldest events are dropped first.
const MAX_EVENTS = 8000

const isMethod = (v: unknown): v is InputMethod => typeof v === 'string' && (INPUT_METHODS as string[]).includes(v)
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0

/** Keeps only events of a shape this version understands; anything else in storage is dropped. */
export function sanitizeUsage(stored: unknown): UsageEvent[] {
  if (!Array.isArray(stored)) return []
  const events: UsageEvent[] = []
  for (const e of stored as Array<Record<string, unknown>>) {
    if (!e || typeof e !== 'object' || !isTime(e.at)) continue
    if (e.k === 'turn' && isMethod(e.m) && (e.gap === null || isTime(e.gap)) && (e.g === 'on' || e.g === 'off' || e.g === 'none')) {
      events.push({ k: 'turn', at: e.at, m: e.m, gap: e.gap as number | null, g: e.g })
    } else if (e.k === 'undo') {
      events.push({ k: 'undo', at: e.at })
    } else if (e.k === 'solve' && isTime(e.ms) && isTime(e.moves) && isMethod(e.m) && typeof e.help === 'boolean' && typeof e.ranked === 'boolean') {
      events.push({ k: 'solve', at: e.at, ms: e.ms, moves: e.moves, m: e.m, help: e.help, ranked: e.ranked })
    }
  }
  return events.slice(-MAX_EVENTS)
}

export function loadUsage(): UsageEvent[] {
  try {
    return sanitizeUsage(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'))
  } catch {
    return []
  }
}

let cache: UsageEvent[] | null = null
let saveTimer: ReturnType<typeof setTimeout> | undefined

/** Adds an event. Writes to storage are batched: a turn must never wait on the disk. */
export function recordUsage(event: UsageEvent): void {
  cache ??= loadUsage()
  cache.push(event)
  if (cache.length > MAX_EVENTS) cache = cache.slice(-MAX_EVENTS)
  clearTimeout(saveTimer)
  saveTimer = setTimeout(flushUsage, 1500)
}

/** Writes what has been recorded so far. Called on a timer, and when the page is hidden. */
export function flushUsage(): void {
  clearTimeout(saveTimer)
  if (!cache) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // Storage full or blocked: the log is a nicety, never a reason to fail.
  }
}

export function clearUsage(): void {
  cache = []
  clearTimeout(saveTimer)
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing was stored.
  }
}

/** Everything recorded, including what has not been written to storage yet. */
export function currentUsage(): UsageEvent[] {
  cache ??= loadUsage()
  return cache
}

// ---- Summaries ---------------------------------------------------------------

export interface MethodSummary {
  method: InputMethod
  turns: number
  /** Median time between consecutive turns, in ms, ignoring pauses to think; null with too few turns. */
  medianGapMs: number | null
  /** Turns per minute at that pace. */
  turnsPerMinute: number | null
  /** Turns made with the guide showing. */
  guided: number
  /** Of those, the share that were not the turn the guide asked for. */
  offTrackRate: number | null
  solves: number
  /** Median time of this method's unassisted solves of a random scramble, in ms. */
  medianSolveMs: number | null
}

// A gap longer than this is someone thinking (or away), not how fast the method is.
const THINKING_MS = 8000
const MIN_SAMPLES = 5

const median = (values: number[]): number | null => {
  if (values.length < MIN_SAMPLES) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function summariseUsage(events: UsageEvent[]): { methods: MethodSummary[]; undos: number; turns: number } {
  const turns = events.filter((e): e is TurnEvent => e.k === 'turn')
  const solves = events.filter((e): e is SolveEvent => e.k === 'solve')
  const methods = INPUT_METHODS.map((method) => {
    const mine = turns.filter((t) => t.m === method)
    const guided = mine.filter((t) => t.g !== 'none')
    const medianGapMs = median(mine.flatMap((t) => (t.gap !== null && t.gap <= THINKING_MS ? [t.gap] : [])))
    const mySolves = solves.filter((s) => s.m === method && !s.help && s.ranked)
    return {
      method,
      turns: mine.length,
      medianGapMs,
      turnsPerMinute: medianGapMs ? 60_000 / medianGapMs : null,
      guided: guided.length,
      offTrackRate: guided.length >= MIN_SAMPLES ? guided.filter((t) => t.g === 'off').length / guided.length : null,
      solves: mySolves.length,
      medianSolveMs: mySolves.length ? [...mySolves].sort((a, b) => a.ms - b.ms)[Math.floor(mySolves.length / 2)].ms : null,
    }
  })
  return { methods, undos: events.filter((e) => e.k === 'undo').length, turns: turns.length }
}

/** The method most of these turns were made with (ties go to the earlier in INPUT_METHODS). */
export function dominantMethod(methods: InputMethod[]): InputMethod {
  let best: InputMethod = 'drag'
  let bestCount = -1
  for (const method of INPUT_METHODS) {
    const count = methods.filter((m) => m === method).length
    if (count > bestCount) [best, bestCount] = [method, count]
  }
  return best
}
