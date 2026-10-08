import { create } from 'zustand'
import { PUZZLE_REGISTRY } from '../core/puzzles/registry'
import type { Move, PuzzleId, PuzzlePlugin, PuzzleState } from '../core/puzzles/PuzzlePlugin'

export interface PuzzleStore {
  plugin: PuzzlePlugin | null
  state: PuzzleState | null
  moveHistory: Move[]
  /**
   * How many of the moves in `moveHistory` set the puzzle up (a scramble, a
   * lesson's practice position) rather than being the player's own. That
   * position is where the attempt starts: Undo stops there and
   * `resetToStart` returns there, so nobody can undo their way through the
   * scramble to a solved cube.
   */
  startLength: number
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null

  load: (id: PuzzleId) => Promise<void>
  applyMove: (move: Move) => void
  /** Takes back the last move, unless that would go behind the start of the attempt. */
  undo: () => void
  /** Back to a solved puzzle, with no start position. */
  reset: () => void
  /** The puzzle as it is now becomes the start of the attempt. */
  markStart: () => void
  /** Back to the start of the attempt, dropping every move made since. */
  resetToStart: () => void
  isSolved: () => boolean
}

// Counts loads, so one that finishes late can tell it has been overtaken.
let loadGeneration = 0

export const usePuzzleStore = create<PuzzleStore>((set, get) => ({
  plugin: null,
  state: null,
  moveHistory: [],
  startLength: 0,
  status: 'idle',
  error: null,

  load: async (id) => {
    const generation = ++loadGeneration
    const loader = PUZZLE_REGISTRY[id]
    if (!loader) {
      set({ status: 'error', error: `unknown puzzle: ${id}` })
      return
    }
    set({ status: 'loading', error: null })
    try {
      const plugin = await loader()
      if (generation !== loadGeneration) return // a newer load has started; this one is stale
      set({
        plugin,
        state: plugin.createInitialState(),
        moveHistory: [],
        startLength: 0,
        status: 'ready',
      })
    } catch (e) {
      if (generation !== loadGeneration) return
      set({ status: 'error', error: (e as Error).message })
    }
  },

  applyMove: (move) => {
    const { plugin, state, moveHistory } = get()
    if (!plugin || !state) return
    set({
      state: plugin.applyMove(state, move),
      moveHistory: [...moveHistory, move],
    })
  },

  undo: () => {
    const { plugin, state, moveHistory, startLength } = get()
    if (!plugin || !state || moveHistory.length <= startLength) return
    const last = moveHistory[moveHistory.length - 1]
    set({
      state: plugin.applyMove(state, { alg: last.alg.invert(), snapAngleDeg: last.snapAngleDeg }),
      moveHistory: moveHistory.slice(0, -1),
    })
  },

  reset: () => {
    const { plugin } = get()
    if (!plugin) return
    set({ state: plugin.createInitialState(), moveHistory: [], startLength: 0 })
  },

  markStart: () => set({ startLength: get().moveHistory.length }),

  resetToStart: () => {
    const { plugin, moveHistory, startLength } = get()
    if (!plugin) return
    const setup = moveHistory.slice(0, startLength)
    set({ state: setup.reduce(plugin.applyMove, plugin.createInitialState()), moveHistory: setup })
  },

  isSolved: () => {
    const { plugin, state } = get()
    return Boolean(plugin && state && plugin.isSolved(state))
  },
}))
