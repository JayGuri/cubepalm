import { Alg } from 'cubing/alg'
import { beforeEach, describe, expect, it } from 'vitest'
import { usePuzzleStore } from './puzzleStore'

const move = (s: string) => ({ alg: new Alg(s), snapAngleDeg: 90 })
const store = () => usePuzzleStore.getState()

describe('puzzleStore', () => {
  beforeEach(async () => {
    await store().load('cube3')
  })

  it('loads cube3 into a ready, solved state', () => {
    expect(store().status).toBe('ready')
    expect(store().plugin?.id).toBe('cube3')
    expect(store().isSolved()).toBe(true)
    expect(store().moveHistory).toHaveLength(0)
  })

  it('reports an unknown puzzle as an error instead of hanging', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await store().load('nope' as any)
    expect(store().status).toBe('error')
    expect(store().error).toMatch(/unknown puzzle/)
  })

  it('applies a move, recording history and unsolving', () => {
    store().applyMove(move('R'))
    expect(store().moveHistory).toHaveLength(1)
    expect(store().isSolved()).toBe(false)
  })

  it('undo reverses the last move', () => {
    store().applyMove(move('R'))
    store().applyMove(move('U'))
    store().undo()
    expect(store().moveHistory).toHaveLength(1)
    store().undo()
    expect(store().moveHistory).toHaveLength(0)
    expect(store().isSolved()).toBe(true)
  })

  it('undo on an empty history is a no-op, not a crash', () => {
    store().undo()
    expect(store().moveHistory).toHaveLength(0)
    expect(store().isSolved()).toBe(true)
  })

  it('reset returns to solved and clears history', () => {
    store().applyMove(move('R'))
    store().reset()
    expect(store().isSolved()).toBe(true)
    expect(store().moveHistory).toHaveLength(0)
  })

  it('a load that finishes late does not overwrite a newer one', async () => {
    // Two loads started back to back: whichever resolves last must not win
    // unless it was also the one asked for last.
    const first = store().load('mirror')
    const second = store().load('cube3')
    await Promise.all([first, second])
    expect(store().plugin?.id).toBe('cube3')
    expect(store().status).toBe('ready')
  })

  describe('the start of an attempt', () => {
    it('Undo stops at the scramble instead of walking back through it', () => {
      for (const m of ['R', 'U', 'F']) store().applyMove(move(m))
      store().markStart()
      const scrambled = store().state
      store().applyMove(move('L'))
      store().applyMove(move('D'))
      store().undo()
      store().undo()
      expect(store().moveHistory).toHaveLength(3)
      // Further undos do nothing: the scramble is not the player's to take back.
      store().undo()
      store().undo()
      expect(store().moveHistory).toHaveLength(3)
      expect(store().isSolved()).toBe(false)
      expect(store().plugin!.faceletColors(store().state!)).toEqual(store().plugin!.faceletColors(scrambled!))
    })

    it('resetToStart returns to the scrambled position, not to solved', () => {
      for (const m of ['R', 'U', 'F']) store().applyMove(move(m))
      store().markStart()
      const scrambled = store().plugin!.faceletColors(store().state!)
      for (const m of ['L', 'D', 'B', "R'"]) store().applyMove(move(m))
      store().resetToStart()
      expect(store().moveHistory.map((m) => m.alg.toString())).toEqual(['R', 'U', 'F'])
      expect(store().plugin!.faceletColors(store().state!)).toEqual(scrambled)
      expect(store().isSolved()).toBe(false)
    })

    it('with no scramble the start is the solved cube, and reset() forgets a start', () => {
      store().applyMove(move('R'))
      store().resetToStart()
      expect(store().isSolved()).toBe(true)
      store().applyMove(move('R'))
      store().markStart()
      store().reset()
      expect(store().startLength).toBe(0)
      expect(store().isSolved()).toBe(true)
    })
  })
})
