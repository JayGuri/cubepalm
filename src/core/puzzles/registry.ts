import type { PuzzleId, PuzzlePlugin } from './PuzzlePlugin'

// Two puzzles ship: the 3x3 and the Mirror Cube. Each is loaded on demand, and
// the registry is the one place that lists them, so adding a puzzle touches
// nothing else.
export const PUZZLE_REGISTRY: Record<PuzzleId, () => Promise<PuzzlePlugin>> = {
  cube3: async () => (await import('./cube3')).createCube3Plugin(),
  mirror: async () => (await import('./mirror')).createMirrorPlugin(),
}

export function isPuzzleAvailable(id: string): id is PuzzleId {
  return id in PUZZLE_REGISTRY
}

export const AVAILABLE_PUZZLE_IDS: PuzzleId[] = Object.keys(PUZZLE_REGISTRY) as PuzzleId[]
