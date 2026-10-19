import { refineFromHistory, solveFromHistory } from '../../solvers/kociemba'
import type { Move, PuzzlePlugin } from '../PuzzlePlugin'
import { buildCube3Geometry, CUBE3_COLORS } from './geometry'
import {
  applyMove,
  createInitialState,
  initCube3Logic,
  isSolved,
  scramble,
} from './logic'
import { faceletColors } from './sync'

// async because the cubing KPuzzle load is async -- callers never see an
// uninitialised plugin.
export async function createCube3Plugin(): Promise<PuzzlePlugin> {
  await initCube3Logic()

  return {
    id: 'cube3',
    displayName: '3×3 Cube',

    createInitialState,
    applyMove,
    isSolved,
    scramble,
    solve: async (_state, history: Move[], effort) => solveFromHistory(history, 90, { effort }),
    refine: (history: Move[], bound, onUpdate) => refineFromHistory(history, bound, onUpdate),

    buildGeometry: buildCube3Geometry,
    colorScheme: CUBE3_COLORS,
    faceletColors,

    snapAngleDeg: 90,

  }
}
