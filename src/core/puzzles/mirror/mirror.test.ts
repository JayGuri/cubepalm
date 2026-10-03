import { Alg } from 'cubing/alg'
import { describe, expect, it } from 'vitest'
import { createPieces, currentSlot } from './pieces'
import { buildMirrorGeometry, MIRROR_EXTENTS, pieceBox } from './geometry'
import { isSolved as cube3Solved } from '../cube3/logic'
import { createMirrorPlugin, mirrorPiecesOf } from '.'

describe('mirror geometry', () => {
  it('sizes each piece from the layer thicknesses', () => {
    const near = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]))
    near(pieceBox([1, 1, 1]).size, [MIRROR_EXTENTS.R, MIRROR_EXTENTS.U, MIRROR_EXTENTS.F])
    near(pieceBox([-1, -1, -1]).size, [MIRROR_EXTENTS.L, MIRROR_EXTENTS.D, MIRROR_EXTENTS.B])
    near(pieceBox([0, 1, 0]).size, [1, MIRROR_EXTENTS.U, 1])
    expect(buildMirrorGeometry().pieces).toHaveLength(26)
  })

  it('tiles a 3x3x3 cuboid with no overlap', () => {
    const boxes = createPieces().map((p) => pieceBox(p.home))
    for (let a = 0; a < 3; a++) {
      const lo = Math.min(...boxes.map((b) => b.center[a] - b.size[a] / 2))
      const hi = Math.max(...boxes.map((b) => b.center[a] + b.size[a] / 2))
      expect(hi - lo).toBeCloseTo(3)
    }
    // 26 pieces + the 1x1x1 hidden core = 27, and boxes come from disjoint slabs.
    const volume = boxes.reduce((s, b) => s + b.size[0] * b.size[1] * b.size[2], 1)
    expect(volume).toBeCloseTo(27)
  })
})

describe('mirror plugin', () => {
  const move = (m: string) => ({ alg: new Alg(m), snapAngleDeg: 90 })

  it('is solved initially and not after R', async () => {
    const plugin = await createMirrorPlugin()
    const s = plugin.createInitialState()
    expect(plugin.isSolved(s)).toBe(true)
    expect(plugin.isSolved(plugin.applyMove(s, move('R')))).toBe(false)
  })

  it('scramble then solve returns every piece home', async () => {
    const plugin = await createMirrorPlugin()
    const scramble = await plugin.scramble()
    let s = scramble.reduce(plugin.applyMove, plugin.createInitialState())
    const { moves: solution } = await plugin.solve(s, scramble)
    s = solution.reduce(plugin.applyMove, s)
    expect(plugin.isSolved(s)).toBe(true)
    for (const p of mirrorPiecesOf(s)) {
      expect(currentSlot(p)).toEqual(p.home)
      const isCentre = p.home.filter((v) => v !== 0).length === 1
      if (!isCentre) expect(p.rotation).toEqual([[1, 0, 0], [0, 1, 0], [0, 0, 1]])
    }
  }, 30000)

  // Shape decides whether the Mirror Cube is solved. The 3x3 colour pattern kept
  // beside it (for the solver) must never disagree while only faces are turned.
  it('shape and colour pattern agree after every face-turn sequence', async () => {
    const plugin = await createMirrorPlugin()
    const faces = ['R', "R'", 'R2', 'U', "U'", 'U2', 'F', "F'", 'F2', 'L', "L'", 'L2', 'D', "D'", 'D2', 'B', "B'", 'B2']
    let seed = 12345
    const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff)
    for (let round = 0; round < 40; round++) {
      let s = plugin.createInitialState()
      const done: string[] = []
      for (let i = 0; i < 12; i++) {
        const m = faces[next() % faces.length]
        done.push(m)
        s = plugin.applyMove(s, move(m))
        const pattern = (s.raw as { pattern: Parameters<typeof cube3Solved>[0] }).pattern
        expect(plugin.isSolved(s), done.join(' ')).toBe(cube3Solved(pattern))
      }
      // ...and undoing the lot brings the shape back.
      for (const m of done.reverse()) s = plugin.applyMove(s, { alg: new Alg(m).invert(), snapAngleDeg: 90 })
      expect(plugin.isSolved(s)).toBe(true)
    }
  })

  it('every single turn unsolves it, and its inverse solves it again', async () => {
    const plugin = await createMirrorPlugin()
    for (const m of ['R', 'U', 'F', 'L', 'D', 'B', 'M', 'E', 'S']) {
      const turned = plugin.applyMove(plugin.createInitialState(), move(m))
      expect(plugin.isSolved(turned), m).toBe(false)
      expect(plugin.isSolved(plugin.applyMove(turned, move(m + "'"))), m).toBe(true)
    }
  })
})
