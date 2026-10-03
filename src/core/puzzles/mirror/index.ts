import { refineFromHistory, solveFromHistory } from '../../solvers/kociemba'
import type { Move, PuzzlePlugin, PuzzleState } from '../PuzzlePlugin'
import * as cube3 from '../cube3/logic'
import { facesOfSlot } from '../cube3/geometry'
import { buildMirrorGeometry, mirrorPieceId } from './geometry'
import { applyMoveToPieces, createPieces, piecesSolved, type TrackedPiece } from './pieces'

export const MIRROR_SILVER = '#C0C0C0'

interface MirrorRaw {
  pattern: PuzzleState
  pieces: TrackedPiece[]
}

const rawOf = (state: PuzzleState) => state.raw as MirrorRaw

export { mirrorPiecesOf } from './pieces'

// Same group as the 3x3 (centre orientation ignored), so logic, scramble and
// the Kociemba solver all delegate to cube3; only the piece tracker is extra.
export async function createMirrorPlugin(): Promise<PuzzlePlugin> {
  await cube3.initCube3Logic()

  return {
    id: 'mirror',
    displayName: 'Mirror Cube',

    createInitialState: () => ({ raw: { pattern: cube3.createInitialState(), pieces: createPieces() } }),
    applyMove: (state, move) => {
      const { pattern, pieces } = rawOf(state)
      return {
        raw: {
          pattern: cube3.applyMove(pattern, move),
          pieces: applyMoveToPieces(pieces, move.alg.toString()),
        },
      }
    },
    // Shape is the authority here. The 3x3 pattern alongside it exists for the
    // solver and scrambler, and the tests hold the two to agreeing.
    isSolved: (state) => piecesSolved(rawOf(state).pieces),
    scramble: cube3.scramble,
    solve: async (_state, history: Move[], effort) => solveFromHistory(history, 90, { keepOrientation: true, effort }),
    refine: (history: Move[], bound, onUpdate) => refineFromHistory(history, bound, onUpdate, { keepOrientation: true }),

    buildGeometry: buildMirrorGeometry,
    colorScheme: { U: MIRROR_SILVER, D: MIRROR_SILVER, F: MIRROR_SILVER, B: MIRROR_SILVER, R: MIRROR_SILVER, L: MIRROR_SILVER },
    faceletColors: () =>
      new Map(
        createPieces().map(({ home }) => [
          mirrorPieceId(home),
          Object.fromEntries(facesOfSlot(home).map((f) => [f, MIRROR_SILVER])),
        ]),
      ),

    snapAngleDeg: 90,
  }
}
