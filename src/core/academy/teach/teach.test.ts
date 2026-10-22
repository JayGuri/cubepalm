import { KPattern } from 'cubing/kpuzzle'
import { beforeAll, describe, expect, it } from 'vitest'
import { facesOfSlot } from '../../puzzles/cube3/geometry'
import { applyAlgString, createInitialState, initCube3Logic, isSolved, patternOf } from '../../puzzles/cube3/logic'
import { ALL_SLOTS } from '../../puzzles/cube3/sync'
import type { PuzzleState } from '../../puzzles/PuzzlePlugin'
import { LESSONS, lessonById } from '../lessons'
import { STAGE_ORDER, stageBefore, stageDone } from '../stages'
import {
  colourAt,
  cubeStageDone,
  find,
  fromSide,
  HOME_NAMES,
  isSolved as cubeSolved,
  play,
  readState,
  SIDES,
  slotOf,
  SOLVED,
  type Cube,
  type Names,
  type Slot,
} from './cube'
import { practicePosition, randomCube } from './practice'
import { ALGORITHMS, teachCube, teachSolve, type TeachStep } from './teach'

// Seeded, so any failure can be replayed (mulberry32).
function seeded(seed: number) {
  return (n: number) => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 2 ** 32) * n)
  }
}

const ALL_PIECES: Slot[] = []
for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if ([x, y, z].filter((v) => v !== 0).length >= 2) ALL_PIECES.push([x, y, z])
const randomState = (below: (n: number) => number) => randomCube(ALL_PIECES, ALL_PIECES, below)

/** The app's cube (a cubing.js pattern) for a cube in the teacher's model, with centres at home. */
function toPuzzleState(cube: Cube): PuzzleState {
  const base = patternOf(createInitialState())
  const data: Record<string, { pieces: number[]; orientation: number[] }> = {}
  for (const orbit of ['CORNERS', 'EDGES', 'CENTERS'] as const) {
    const defs = ALL_SLOTS.filter((d) => d.orbit === orbit)
    const pieces: number[] = []
    const orientation: number[] = []
    for (const def of defs) {
      const colours = def.faces.map((f) => colourAt(cube, def.slot, f))
      const p = defs.findIndex((d) => colours.every((c) => d.faces.includes(c)))
      const n = def.faces.length
      pieces.push(p)
      orientation.push([0, 1, 2].find((o) => colours.every((c, i) => c === defs[p].faces[(i + o) % n]))!)
    }
    data[orbit] = { pieces, orientation }
  }
  return { raw: new KPattern(base.kpuzzle, data as never) }
}

const COLOUR_WORD = /\b(white|yellow|red|orange|blue|green)\b/g
const isSlot = (s: Slot) => s.length === 3 && s.every((v) => v === -1 || v === 0 || v === 1) && s.some((v) => v !== 0)
const coloursAt = (cube: Cube, names: Names, s: Slot) => facesOfSlot(s).map((f) => names[colourAt(cube, s, f)])
const yellowEdgesUp = (cube: Cube) => SIDES.filter((v) => colourAt(cube, slotOf('U', v), 'U') === 'U').length
const homeOf = (cube: Cube, s: Slot) => slotOf(...facesOfSlot(s).map((f) => colourAt(cube, s, f)))

function ok(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

/** Every promise a step makes, checked on the teacher's model of the cube. */
function checkSteps(start: Cube, names: Names, steps: TeachStep[]): Cube {
  let cube = start
  steps.forEach((step, i) => {
    const where = `step ${i + 1} "${step.title}"`
    const text = `${step.title} ${step.explain}`
    ok(step.moves.length > 0, where)
    for (const m of step.moves) ok(/^[URFDLB][2']?$/.test(m), where)
    ok(step.lessonId === LESSONS.find((l) => l.goal === step.stage)!.id, where)
    if (i > 0) ok(STAGE_ORDER.indexOf(step.stage) >= STAGE_ORDER.indexOf(steps[i - 1].stage), where)
    if (step.title === 'Turn the top') ok(step.moves.every((m) => m[0] === 'U'), where)

    // Focus: real slots, the pieces named are there, and no other colour is mentioned.
    ok(step.focus.pieces.length > 0, where)
    for (const s of step.focus.pieces) ok(isSlot(s), where)
    if (step.focus.target) ok(isSlot(step.focus.target), where)
    const shown = new Set(step.focus.pieces.flatMap((s) => coloursAt(cube, names, s)))
    for (const [word] of text.matchAll(COLOUR_WORD)) ok(shown.has(word), `${where} says ${word}: ${text}`)
    for (const [, ...named] of text.matchAll(/the (\w+)(?:, (\w+))? and (\w+) (?:edge|corner)\b/g)) {
      const colours = named.filter(Boolean).sort().join()
      const there = step.focus.pieces.some((s) => coloursAt(cube, names, s).sort().join() === colours)
      ok(there, `${where} names the ${colours} piece: ${text}`)
    }

    const before = cube
    cube = play(cube, step.moves)
    // The moving piece reaches its target.
    if (step.focus.target) ok(find(cube, homeOf(before, step.focus.pieces[0])).slot.join() === step.focus.target.join(), `${where} reaches its target`)
    // Earlier stages stay done; a stage is done when its last step ends.
    const s = STAGE_ORDER.indexOf(step.stage)
    for (const g of STAGE_ORDER.slice(0, s)) ok(cubeStageDone(g, cube), `${where} keeps ${g}`)
    if (steps[i + 1]?.stage !== step.stage) ok(cubeStageDone(step.stage, cube), `${where} finishes ${step.stage}`)
    // What the text says happens, happens.
    if (/in its place now\.|is solved\.|That makes the \w+ cross|top is \w+ now\./.test(step.explain)) ok(cubeStageDone(step.stage, cube), `${where} finishes as it says`)
    if (/That makes (an L|a line)/.test(step.explain)) ok(yellowEdgesUp(cube) === 2, `${where} makes the shape it says`)
    if (/look again/.test(step.explain)) ok(!cubeStageDone(step.stage, cube), `${where} is not done yet, as it says`)
  })
  return cube
}

describe('the teacher’s cube model', () => {
  beforeAll(initCube3Logic)

  it('turns exactly as cubing.js does', () => {
    const below = seeded(1)
    for (let t = 0; t < 300; t++) {
      const moves = Array.from({ length: 30 }, () => 'URFDLB'[below(6)] + ['', "'", '2'][below(3)])
      expect([...play(SOLVED, moves)]).toEqual([...readState(applyAlgString(createInitialState(), moves.join(' '))).cube])
    }
  })

  it('reads an app cube back exactly, and its random cubes are real cubes', () => {
    const below = seeded(2)
    for (let t = 0; t < 300; t++) {
      const cube = randomState(below)
      expect([...readState(toPuzzleState(cube)).cube]).toEqual([...cube])
    }
  })

  it('names colours as the Academy shows them: white bottom, yellow top, blue front, green back', () => {
    expect(readState(createInitialState()).names).toEqual({ U: 'yellow', D: 'white', F: 'blue', B: 'green', R: 'red', L: 'orange' })
    expect(HOME_NAMES).toEqual(readState(createInitialState()).names)
  })
})

describe('algorithms from every side', () => {
  beforeAll(initCube3Logic)
  const turnTo: Record<string, readonly [string, string]> = { F: ['', ''], R: ['y', "y'"], B: ['y2', 'y2'], L: ["y'", 'y'] }

  it('match the lessons', () => {
    const { trigger, edgeRight, edgeLeft, crossMaker, sune, cornerSwap, edgeCycle } = ALGORITHMS
    const byLesson = { corners: trigger, middle: edgeRight, 'top-cross': crossMaker, 'top-face': sune, 'top-corners': cornerSwap, 'top-edges': edgeCycle }
    for (const [id, alg] of Object.entries(byLesson)) {
      expect(lessonById(id)!.algorithm!.moves).toBe(alg.moves.join(' '))
      expect(lessonById(id)!.algorithm!.name).toBe(alg.name)
    }
    expect(lessonById('middle')!.algorithm!.mirror).toEqual({ name: edgeLeft.name, moves: edgeLeft.moves.join(' ') })
  })

  it('each relabelled variant does what the original does with that side in front', () => {
    const below = seeded(3)
    const random = Array.from({ length: 20 }, () => Array.from({ length: 12 }, () => 'URFDLB'[below(6)] + ['', "'", '2'][below(3)]))
    for (const moves of [...Object.values(ALGORITHMS).map((a) => a.moves), ...random]) {
      for (const side of SIDES) {
        const [to, back] = turnTo[side]
        const held = applyAlgString(createInitialState(), `${to} ${moves.join(' ')} ${back}`)
        const relabelled = applyAlgString(createInitialState(), fromSide(moves, side).join(' '))
        expect(patternOf(relabelled).isIdentical(patternOf(held)), `${moves.join(' ')} from ${side}`).toBe(true)
      }
    }
    expect(fromSide(ALGORITHMS.trigger.moves, 'R').join(' ')).toBe("B U B' U'")
  })
})

describe('teachSolve', () => {
  beforeAll(initCube3Logic)

  it('gives no steps for a solved cube', () => {
    expect(teachSolve(createInitialState())).toEqual([])
  })

  it('solves thousands of random cubes, every step keeping its word', () => {
    const below = seeded(4)
    for (let t = 0; t < 2000; t++) {
      const cube = randomState(below)
      expect(cubeSolved(checkSteps(cube, HOME_NAMES, teachCube(cube, HOME_NAMES))), `cube ${t}`).toBe(true)
    }
  }, 120_000)

  it('solves app cubes, as cubing.js and the Academy’s own stage checks judge them', () => {
    const below = seeded(5)
    for (let t = 0; t < 150; t++) {
      let state = toPuzzleState(randomState(below))
      const steps = teachSolve(state)
      for (const [i, step] of steps.entries()) {
        state = applyAlgString(state, step.moves.join(' '))
        if (steps[i + 1]?.stage !== step.stage) expect(stageDone(step.stage, state)).toBe(true)
        const before = stageBefore(step.stage)
        if (before) expect(stageDone(before, state)).toBe(true)
      }
      expect(isSolved(state)).toBe(true)
    }
  }, 60_000)

  it('works on a cube whose centres were moved by slice turns, naming the colours where they are', () => {
    const below = seeded(6)
    for (let t = 0; t < 100; t++) {
      const scramble = Array.from({ length: 25 }, () => 'URFDLBMESxyz'[below(12)] + ['', "'", '2'][below(3)]).join(' ')
      const start = applyAlgString(createInitialState(), scramble)
      const { cube, names } = readState(start)
      const steps = teachSolve(start)
      checkSteps(cube, names, steps)
      expect(isSolved(applyAlgString(start, steps.flatMap((s) => s.moves).join(' '))), scramble).toBe(true)
    }
  })

  it('covers every case of the method', () => {
    const below = seeded(7)
    const seen = new Set<string>()
    for (let t = 0; t < 400; t++) for (const s of teachCube(randomState(below), HOME_NAMES)) seen.add(s.explain.replace(/the \w+(, \w+)? and \w+ (edge|corner)/gi, 'P').replace(/\b(white|yellow|red|orange|blue|green)\b/g, 'C').replace(/:.*$/, '').replace(/ (once|twice|three times|five times),/, ' N,'))
    // Cross: lifts from the bottom (wrong place, flipped), drops from the middle,
    // lifts from the middle, white up, white sideways; corners: lift (wrong,
    // twisted), align, place; middle: lift (wrong, flipped), align, right and
    // left; three top-cross shapes; three Sune holds; corner and edge cases.
    expect(seen.size).toBeGreaterThanOrEqual(30)
  })

  // Measured alone on a laptop main thread, the median is under 5ms and the
  // 95th percentile under 15ms (see the teach/README). This bound is generous
  // so the test stays meaningful (it would catch a real regression, such as a
  // search blowing up) without turning flaky on a machine busy with other work.
  it('is quick: well under 20 ms a cube on an idle machine', () => {
    const below = seeded(8)
    const cubes = Array.from({ length: 200 }, () => toPuzzleState(randomState(below)))
    const times = cubes.map((state) => {
      const t0 = performance.now()
      teachSolve(state)
      return performance.now() - t0
    })
    times.sort((a, b) => a - b)
    expect(times[100]).toBeLessThan(100)
  })
})

describe('practicePosition', () => {
  beforeAll(initCube3Logic)

  it('gives a solved cube for Meet the cube, and refuses an unknown lesson', () => {
    expect(practicePosition('basics', seeded(9))).toBe('')
    expect(() => practicePosition('nope')).toThrow()
    expect(practicePosition('top-edges')).toMatch(/^[URFDLB]/) // the default generator works
  })

  for (const lesson of LESSONS.filter((l) => l.goal)) {
    it(`${lesson.id}: earlier stages done, its own not, judged by cubing.js`, () => {
      const below = seeded(10 + LESSONS.indexOf(lesson))
      const before = stageBefore(lesson.goal!)
      for (let t = 0; t < 100; t++) {
        const state = applyAlgString(createInitialState(), practicePosition(lesson.id, below))
        if (before) expect(stageDone(before, state)).toBe(true)
        expect(stageDone(lesson.goal!, state)).toBe(false)
      }
    })
  }

  /** Pearson's chi-square against equal counts; with a fixed seed this is a fixed number, checked loosely. */
  function chiSquare(counts: Map<string, number>, cells: number, draws: number) {
    const expected = draws / cells
    let x = (cells - counts.size) * expected // cells never seen
    for (const c of counts.values()) x += (c - expected) ** 2 / expected
    return x
  }
  const tally = (lesson: string, draws: number, seed: number, read: (cube: Cube) => string) => {
    const below = seeded(seed)
    const counts = new Map<string, number>()
    for (let t = 0; t < draws; t++) {
      const k = read(play(SOLVED, practicePosition(lesson, below).split(' ').filter(Boolean)))
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return counts
  }
  const pieceState = (home: Slot) => (cube: Cube) => {
    const f = find(cube, home)
    return `${f.slot} ${facesOfSlot(home).map((h) => f.on[h]).join('')}`
  }
  // df + 4 sqrt(2 df) is far out in the tail for a fair spread, and far below what a skew would give.
  const loose = (df: number) => df + 4 * Math.sqrt(2 * df)

  it('top-edges: the eleven unsolved arrangements come up equally often', () => {
    const counts = tally('top-edges', 3300, 20, (c) => SIDES.map((v) => find(c, slotOf('U', v)).slot.join()).join(' '))
    expect(counts.size).toBe(11)
    expect(chiSquare(counts, 11, 3300)).toBeLessThan(loose(10))
  }, 30_000)

  it('top-corners and top-face: the top pieces are spread evenly', () => {
    const corners = tally('top-corners', 2300, 21, (c) => SIDES.map((v) => find(c, slotOf('U', v, SIDES[(SIDES.indexOf(v) + 1) % 4])).slot.join()).join(' '))
    expect(corners.size).toBe(23) // every corner arrangement but the solved one
    expect(chiSquare(corners, 23, 2300)).toBeLessThan(loose(22))
    const twists = tally('top-face', 2600, 22, (c) => SIDES.map((v) => facesOfSlot(slotOf('U', v, SIDES[(SIDES.indexOf(v) + 1) % 4])).find((f) => colourAt(c, slotOf('U', v, SIDES[(SIDES.indexOf(v) + 1) % 4]), f) === 'U')).join())
    expect(twists.size).toBe(26) // every twist pattern but all-yellow-up
    expect(chiSquare(twists, 26, 2600)).toBeLessThan(loose(25))
  }, 180_000)

  it('cross, corners, middle: a free piece is equally likely in any free slot, either way round', () => {
    const cases: [string, Slot, number][] = [
      ['cross', slotOf('D', 'F'), 24], // 12 slots x 2 ways round
      ['cross', slotOf('D', 'F', 'R'), 24], // 8 slots x 3
      ['corners', slotOf('D', 'B', 'L'), 24],
      ['middle', slotOf('F', 'R'), 16], // 8 edge slots left x 2
      ['top-cross', slotOf('U', 'F'), 8], // 4 x 2, though all-up is drawn again
    ]
    for (const [lesson, home, cells] of cases) {
      const draws = cells * 40
      const c = tally(lesson, draws, 30 + cells, pieceState(home))
      expect(c.size, lesson).toBe(cells)
      if (lesson !== 'top-cross') expect(chiSquare(c, cells, draws), `${lesson} ${home}`).toBeLessThan(loose(cells - 1))
    }
  }, 240_000)
})

