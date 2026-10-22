import { expect, test } from 'vitest'
import { createPieces } from '../../core/puzzles/mirror/pieces'
import { createRefineJob, pathToText, randomScramble } from '../../core/solvers/twoPhase'
import { chiSquare, cyclesOf, FORM_MS, holdRun, groupDigits, inG1, phasesOf, playOnPieces, positionCount, repeatsUntilSolved, viewOf } from './howMath'

test('the number of positions', () => {
  expect(groupDigits(positionCount())).toBe('43,252,003,274,489,856,000')
})

test('a face turn is one cycle of four corners and one of four edges', () => {
  const r = cyclesOf('R')
  expect(r.corners).toHaveLength(1)
  expect(r.edges).toHaveLength(1)
  expect(r.corners[0]).toHaveLength(4)
  expect(r.edges[0]).toHaveLength(4)
  // R carries the front-right corners up and to the back.
  expect(r.corners[0]).toEqual(expect.arrayContaining(['UFR', 'UBR', 'DBR', 'DFR']))
})

test('R U R\' U\' six times solves the cube, and no fewer', () => {
  const rows = repeatsUntilSolved("R U R' U'")
  expect(rows).toHaveLength(6)
  expect(rows.at(-1)).toEqual({ moved: 0, turned: 0 })
  expect(rows.slice(0, 5).every((r) => r.moved + r.turned > 0)).toBe(true)
})

test('chi-square of a perfectly even count is 0', () => {
  expect(chiSquare([5, 5, 5])).toBe(0)
  expect(chiSquare([10, 0])).toBe(10)
})

test('phasesOf splits a real route where phase 1 really ends, in every view', () => {
  const scramble = randomScramble()
  for (let view = 0; view < 6; view++) {
    const job = createRefineJob(scramble, undefined, { index: view, count: 6 })
    let route: string[] = []
    job.onImprove = (path) => (route = pathToText(path).split(' '))
    for (let i = 0; i < 40 && route.length === 0; i++) job.run(20)
    expect(route.length).toBeGreaterThan(0)
    const phases = phasesOf(route, view)
    const phase1 = route.filter((_, i) => phases[i] === 1).join(' ')
    const { faces, inverse } = viewOf(view)
    // Forward: the scramble then phase 1 lands in G1. Inverse: phase 1 then the scramble does.
    const state = inverse ? playOnPieces(playOnPieces(createPieces(), phase1), scramble) : playOnPieces(playOnPieces(createPieces(), scramble), phase1)
    expect(inG1(state, faces)).toBe(true)
    // Phases come in one block each.
    expect(phases.join('')).toMatch(inverse ? /^2*1*$/ : /^1*2*$/)
  }
})

test('a held sign turns once, about 660 ms after it is formed, when no frame is lost', () => {
  const frames = holdRun([0, 0, 1, 1], 'Right', { lose: false, grace: true, seed: 1 })
  const turns = frames.filter((f) => f.turn)
  expect(turns.map((f) => f.turn)).toEqual(['U'])
  expect(turns[0].t - FORM_MS).toBeGreaterThanOrEqual(550)
  expect(turns[0].t - FORM_MS).toBeLessThanOrEqual(800)
})
