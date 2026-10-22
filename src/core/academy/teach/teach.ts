import { sequenceWords } from '../../notation'
import { facesOfSlot, type Face } from '../../puzzles/cube3/geometry'
import type { PuzzleState } from '../../puzzles/PuzzlePlugin'
import { LESSONS } from '../lessons'
import { NORMAL, type StageGoal } from '../stages'
import {
  colourAt,
  find,
  fromSide,
  inPlace,
  isSolved,
  leftOf,
  oppositeOf,
  play,
  quarterTurns,
  readState,
  rightOf,
  sameSlot,
  SIDES,
  slotOf,
  topTurn,
  type Cube,
  type Names,
  type Slot,
} from './cube'

// The teaching solver: solves any cube the way the Academy teaches it, layer
// by layer, one explained step at a time. See README.md for the method.

export interface TeachStep {
  /** The stage this step works towards: the goal of lesson `lessonId`. */
  stage: StageGoal
  lessonId: string
  /** A few words: "Bring the white and red edge down". */
  title: string
  /** What to look at and what to do, ending with the turns in words. */
  explain: string
  /** Face turns in the app's fixed frame ("R", "U'", "F2"), never a whole-cube turn. */
  moves: string[]
  /** The lesson's algorithm this step uses, by its name in the lesson. */
  algorithm?: string
  /** `pieces`: slots of the pieces the step is about, at its start. `target`: where the piece is going. */
  focus: { pieces: Slot[]; target?: Slot }
}

const algorithm = (name: string, moves: string) => ({ name, moves: moves.split(' ') })

/** The lessons' algorithms, as done from the front. */
export const ALGORITHMS = {
  trigger: algorithm('The trigger', "R U R' U'"),
  edgeRight: algorithm('Edge to the right', "U R U' R' U' F' U F"),
  edgeLeft: algorithm('Edge to the left', "U' L' U L U F U' F'"),
  crossMaker: algorithm('Cross maker', "F R U R' U' F'"),
  sune: algorithm('The Sune', "R U R' U R U2 R'"),
  cornerSwap: algorithm('Corner swap', "R' F R' B2 R F' R' B2 R2"),
  edgeCycle: algorithm('Edge cycle', "R U' R U R U R U' R' U' R2"),
}
const { trigger, edgeRight, edgeLeft, crossMaker, sune, cornerSwap, edgeCycle } = ALGORITHMS

type Draft = Omit<TeachStep, 'stage' | 'lessonId'>

/** Steps tried out on a copy of the cube before any is said. */
class Plan {
  steps: Draft[] = []
  cube: Cube
  constructor(cube: Cube) {
    this.cube = cube
  }
  add(step: Draft) {
    this.steps.push(step)
    this.cube = play(this.cube, step.moves)
  }
  append(other: Plan) {
    this.steps.push(...other.steps)
    this.cube = other.cube
  }
  get cost() {
    return this.steps.reduce((n, s) => n + quarterTurns(s.moves), 0)
  }
}

/** The cheapest plan; the first one on a tie, so the choice is always the same. */
const cheapest = (plans: Plan[]) => plans.reduce((best, p) => (p.cost < best.cost ? p : best))

const unsolvable = () => new Error('That is not a cube that can be solved.')

// --- Words ------------------------------------------------------------------------

const say = (moves: string[]) => sequenceWords(moves.join(' '))
const capital = (s: string) => s[0].toUpperCase() + s.slice(1)
const TIMES = ['', 'once', 'twice', 'three times', 'four times', 'five times']
const isSide = (f: Face) => SIDES.includes(f)

/** "the white and red edge", "the white, red and green corner": top or bottom colour first, then left to right. */
function pieceName(names: Names, home: Slot): string {
  const faces = facesOfSlot(home)
  const sides = faces.filter(isSide)
  if (sides.length === 2 && rightOf(sides[1]) === sides[0]) sides.reverse()
  const c = [...faces.filter((f) => !isSide(f)), ...sides].map((f) => names[f])
  return c.length === 2 ? `the ${c[0]} and ${c[1]} edge` : `the ${c[0]}, ${c[1]} and ${c[2]} corner`
}

// --- Where things are -------------------------------------------------------------

/** The side face of an edge in the top or bottom layer. */
const sideOf = (slot: Slot) => facesOfSlot(slot).find(isSide)!
/** For a corner, or a middle edge: the side V it sits at the front-right of, looking at V. */
const frontOf = (slot: Slot) =>
  SIDES.find((v) => NORMAL[v][0] + NORMAL[rightOf(v)][0] === slot[0] && NORMAL[v][2] + NORMAL[rightOf(v)][2] === slot[2])!
/** The home of the piece now at `slot`. */
const homeOfPieceAt = (cube: Cube, slot: Slot) => slotOf(...facesOfSlot(slot).map((f) => colourAt(cube, slot, f)))
const repeat = (moves: string[], n: number) => Array.from({ length: n }, () => moves).flat()
const TOP_TURNS = [[], ['U'], ["U'"], ['U2']]

const TOP_EDGES = SIDES.map((v) => slotOf('U', v))
const TOP_CORNERS = SIDES.map((v) => slotOf('U', v, rightOf(v)))

// --- 1. The white cross -------------------------------------------------------------

function cross(cube: Cube, names: Names): Plan {
  const plan = new Plan(cube)
  for (;;) {
    const options = SIDES.filter((x) => !inPlace(plan.cube, slotOf('D', x))).map((x) => crossEdge(plan.cube, names, x))
    if (!options.length) return plan
    plan.append(cheapest(options))
  }
}

/** Brings the white edge whose other colour is the centre of side `x` home. */
function crossEdge(cube: Cube, names: Names, x: Face): Plan {
  const plan = new Plan(cube)
  const home = slotOf('D', x)
  const edge = pieceName(names, home)
  const [w, xn] = [names.D, names[x]]
  let at = find(cube, home)

  if (at.slot[1] === -1) {
    // On the bottom but wrong: a half turn of its side lifts it straight up.
    const s = sideOf(at.slot)
    const why = sameSlot(at.slot, home) ? `is in its place but flipped, with ${w} facing out` : 'is on the bottom, but in the wrong place'
    const moves = [`${s}2`]
    plan.add({
      title: `Lift ${edge} out`,
      explain: `${capital(edge)} ${why}. Turn the face it is on twice to lift it to the top: ${say(moves)}.`,
      moves,
      focus: { pieces: [at.slot], target: slotOf('U', s) },
    })
    at = find(plan.cube, home)
  }

  if (at.slot[1] === 0) {
    const p = at.on[x]!
    if (p === x) {
      // Its colour already faces its own centre: one turn of that face drops it in.
      const moves = [[x], [`${x}'`]].find((m) => inPlace(play(plan.cube, m), home))!
      plan.add({
        title: `Bring ${edge} down`,
        explain: `${capital(edge)} is in the middle layer, with its ${xn} side next to the ${xn} centre. Turn the ${xn} face so the edge drops to the bottom, ${w} facing down: ${say(moves)}.`,
        moves,
        focus: { pieces: [at.slot, NORMAL[x]], target: home },
      })
      return plan
    }
    // As the lesson says: lift it with the side face not showing white, turn the
    // top once to move it aside, turn that face back. White then faces up. Move
    // it aside whichever way leaves the shorter turn of the top afterwards.
    const up = [`${p}`, `${p}'`].find((m) => find(play(plan.cube, [m]), home).slot[1] === 1)!
    const back = up.endsWith("'") ? p : `${p}'`
    const moves = [
      [up, 'U', back],
      [up, "U'", back],
    ].reduce((a, b) => (alignCost(plan.cube, b, home, x) < alignCost(plan.cube, a, home, x) ? b : a))
    plan.add({
      title: `Lift ${edge} out`,
      explain: `${capital(edge)} is in the middle layer, but its ${xn} side is not next to the ${xn} centre. Turn the side face that does not show ${w} so the edge rises into the top layer, turn the top once to move it aside, then turn that face back. ${capital(w)} now faces up: ${say(moves)}.`,
      moves,
      focus: { pieces: [at.slot], target: find(play(plan.cube, moves), home).slot },
    })
    at = find(plan.cube, home)
  }

  const s = sideOf(at.slot)
  if (at.on.D === 'U') {
    // On top, white up: line it up over its centre, then a half turn brings it down.
    const align = topTurn(s, x)
    if (align.length)
      plan.add({
        title: 'Turn the top',
        explain: `${capital(edge)} is on top with ${w} facing up. Turn the top until it sits above the ${xn} centre: ${say(align)}.`,
        moves: align,
        focus: { pieces: [at.slot, NORMAL[x]], target: slotOf('U', x) },
      })
    const moves = [`${x}2`]
    plan.add({
      title: `Bring ${edge} down`,
      explain: `${capital(edge)} is above the ${xn} centre with ${w} facing up. Turn the ${xn} face twice to bring it down, ${w} facing down: ${say(moves)}.`,
      moves,
      focus: { pieces: [slotOf('U', x), NORMAL[x]], target: home },
    })
    return plan
  }

  // On top, white facing out: the lesson's way. Seen with its centre on the
  // right, the piece goes to the front (above side h) and F R' F' drops it in.
  const way = { h: leftOf(x), moves: fromSide(['F', "R'", "F'"], leftOf(x)) }
  const hn = names[way.h]
  const align = topTurn(s, way.h)
  if (align.length)
    plan.add({
      title: 'Turn the top',
      explain: `${capital(edge)} is on top with ${w} facing out to the side. Turn the top until it sits above the ${hn} centre, next to the ${xn} centre: ${say(align)}.`,
      moves: align,
      focus: { pieces: [at.slot, NORMAL[way.h], NORMAL[x]], target: slotOf('U', way.h) },
    })
  plan.add({
    title: `Bring ${edge} down`,
    explain: `${capital(edge)} is above the ${hn} centre with ${w} facing out. Turn the ${hn} face to take it down to the middle layer, turn the ${xn} face to swing it into place, then turn the ${hn} face back: ${say(way.moves)}.`,
    moves: way.moves,
    focus: { pieces: [slotOf('U', way.h), NORMAL[way.h], NORMAL[x]], target: home },
  })
  return plan
}

/** Quarter turns of the top still needed after `moves` to bring the edge over side `x`. */
function alignCost(cube: Cube, moves: string[], home: Slot, x: Face): number {
  return quarterTurns(topTurn(sideOf(find(play(cube, moves), home).slot), x))
}

// --- 2. The white corners -----------------------------------------------------------

function corners(cube: Cube, names: Names): Plan {
  const plan = new Plan(cube)
  for (;;) {
    const todo = SIDES.map((v) => slotOf('D', v, rightOf(v))).filter((h) => !inPlace(plan.cube, h))
    if (!todo.length) return plan
    // As the lesson says: a corner already in the top layer first.
    const onTop = todo.filter((h) => find(plan.cube, h).slot[1] === 1)
    plan.append(cheapest((onTop.length ? onTop : todo).map((h) => corner(plan.cube, names, h))))
  }
}

function corner(cube: Cube, names: Names, home: Slot): Plan {
  const plan = new Plan(cube)
  const name = pieceName(names, home)
  let at = find(cube, home)
  if (at.slot[1] === -1) {
    const v = frontOf(at.slot)
    const moves = fromSide(trigger.moves, v)
    plan.add({
      title: `Lift ${name} out`,
      explain: `${capital(name)} is in the bottom layer, but ${sameSlot(at.slot, home) ? 'twisted' : 'in the wrong place'}. Do the trigger once from the ${names[v]} side to lift it to the top: ${say(moves)}.`,
      moves,
      algorithm: trigger.name,
      focus: { pieces: [at.slot, NORMAL[v]], target: slotOf('U', v, rightOf(v)) },
    })
    at = find(plan.cube, home)
  }
  const x = frontOf(home)
  const y = rightOf(x)
  const above = slotOf('U', x, y)
  const align = topTurn(frontOf(at.slot), x)
  if (align.length)
    plan.add({
      title: 'Turn the top',
      explain: `${capital(name)} is in the top layer. Turn the top until it sits right above its home, between the ${names[x]} and ${names[y]} centres: ${say(align)}.`,
      moves: align,
      focus: { pieces: [at.slot, NORMAL[x], NORMAL[y]], target: above },
    })
  // One, three or five triggers, depending on which way the corner faces.
  const once = fromSide(trigger.moves, x)
  let n = 1
  while (!inPlace(play(plan.cube, repeat(once, n)), home)) if (++n > 5) throw unsolvable()
  plan.add({
    title: `Place ${name}`,
    explain: `${capital(name)} is right above its home. Do the trigger from the ${names[x]} side ${TIMES[n]}, until it drops in with ${names.D} facing down: ${say(once)}.`,
    moves: repeat(once, n),
    algorithm: trigger.name,
    focus: { pieces: [above, NORMAL[x], NORMAL[y]], target: home },
  })
  return plan
}

// --- 3. The middle layer ---------------------------------------------------------------

function middle(cube: Cube, names: Names): Plan {
  const plan = new Plan(cube)
  for (;;) {
    const todo = SIDES.map((v) => slotOf(v, rightOf(v))).filter((h) => !inPlace(plan.cube, h))
    if (!todo.length) return plan
    const onTop = todo.filter((h) => find(plan.cube, h).slot[1] === 1)
    plan.append(cheapest((onTop.length ? onTop : todo).map((h) => middleEdge(plan.cube, names, h))))
  }
}

function middleEdge(cube: Cube, names: Names, home: Slot): Plan {
  const plan = new Plan(cube)
  const name = pieceName(names, home)
  let at = find(cube, home)
  if (at.slot[1] === 0) {
    const v = frontOf(at.slot)
    const moves = fromSide(edgeRight.moves, v)
    plan.add({
      title: `Lift ${name} out`,
      explain: `${capital(name)} is in the middle layer, but ${sameSlot(at.slot, home) ? 'flipped' : 'in the wrong place'}. Do Edge to the right from the ${names[v]} side to lift it to the top: ${say(moves)}.`,
      moves,
      algorithm: edgeRight.name,
      focus: { pieces: [at.slot, NORMAL[v]], target: find(play(cube, moves), home).slot },
    })
    at = find(plan.cube, home)
  }
  // a: the colour on its side, b: the colour on top.
  const s = sideOf(at.slot)
  const [p, q] = facesOfSlot(home)
  const a = at.on[p] === s ? p : q
  const b = a === p ? q : p
  const align = topTurn(s, a)
  if (align.length)
    plan.add({
      title: 'Turn the top',
      explain: `${capital(name)} is in the top layer. Turn the top until its ${names[a]} side sits above the ${names[a]} centre: ${say(align)}.`,
      moves: align,
      focus: { pieces: [at.slot, NORMAL[a]], target: slotOf('U', a) },
    })
  const way = b === rightOf(a) ? 'right' : 'left'
  const alg = way === 'right' ? edgeRight : edgeLeft
  const moves = fromSide(alg.moves, a)
  plan.add({
    title: `Place ${name}`,
    explain: `${capital(name)} is above the ${names[a]} centre with ${names[b]} on top. Looking at the ${names[a]} side, the ${names[b]} centre is on the ${way}, so do Edge to the ${way} from the ${names[a]} side: ${say(moves)}.`,
    moves,
    algorithm: alg.name,
    focus: { pieces: [slotOf('U', a), NORMAL[a], NORMAL[b]], target: home },
  })
  return plan
}

// --- 4. The yellow cross --------------------------------------------------------------

function topCross(cube: Cube, names: Names): Plan {
  const plan = new Plan(cube)
  const yellow = names.U
  const focus = { pieces: [...TOP_EDGES, NORMAL.U] }
  const upOf = (c: Cube) => SIDES.filter((v) => colourAt(c, slotOf('U', v), 'U') === 'U')
  for (let go = 0; go < 4; go++) {
    const up = upOf(plan.cube)
    if (up.length === 4) return plan
    const shape = up.length === 0 ? 'dot' : up.includes(oppositeOf(up[0])) ? 'line' : 'L'
    if (shape === 'line' && !up.includes('L')) {
      plan.add({
        title: 'Turn the top',
        explain: `The ${yellow} edges on top make a line through the centre. Turn the top so the line runs from left to right: ${say(['U'])}.`,
        moves: ['U'],
        focus,
      })
    } else if (shape === 'L') {
      // The L points to the back and the left once its corner side is at the back.
      const align = topTurn(up.find((v) => up.includes(rightOf(v)))!, 'B')
      if (align.length)
        plan.add({
          title: 'Turn the top',
          explain: `The ${yellow} edges on top make an L with the centre. Turn the top so the L points to the back and the left: ${say(align)}.`,
          moves: align,
          focus,
        })
    }
    const after = upOf(play(plan.cube, crossMaker.moves)).length
    const seen = {
      dot: `The top shows a ${yellow} dot: no ${yellow} edge faces up.`,
      L: `The ${yellow} edges make an L pointing to the back and the left.`,
      line: `The ${yellow} edges make a line from left to right.`,
    }[shape]
    const next = after === 4 ? `That makes the ${yellow} cross.` : `That makes ${shape === 'dot' ? 'an L' : 'a line'}. Then look again.`
    plan.add({
      title: `Make the ${yellow} cross`,
      explain: `${seen} Do the cross maker: ${say(crossMaker.moves)}. ${next}`,
      moves: crossMaker.moves,
      algorithm: crossMaker.name,
      focus,
    })
  }
  throw unsolvable()
}

// --- 5. The yellow face ---------------------------------------------------------------

function topFace(cube: Cube, names: Names): Plan {
  const plan = new Plan(cube)
  const yellow = names.U
  const frontLeft = slotOf('U', 'L', 'F')
  const facing = (c: Cube, s: Slot) => facesOfSlot(s).find((f) => colourAt(c, s, f) === 'U')
  const upCount = (c: Cube) => TOP_CORNERS.filter((s) => facing(c, s) === 'U').length
  for (let go = 0; go < 4; go++) {
    const n = upCount(plan.cube)
    if (n === 4) return plan
    // How to hold it: one yellow on top -> that corner at the front-left; none ->
    // a front-left corner with yellow facing left; two -> one facing the front.
    const want: Face = n === 1 ? 'U' : n === 0 ? 'L' : 'F'
    const align = TOP_TURNS.find((t) => facing(play(plan.cube, t), frontLeft) === want)
    if (!align) throw unsolvable()
    const rule = [
      `No corner shows ${yellow} on top. Turn the top until the front-left corner has its ${yellow} facing left: ${say(align)}.`,
      `One corner shows ${yellow} on top. Turn the top so it is at the front-left: ${say(align)}.`,
      `Two corners show ${yellow} on top. Turn the top until the front-left corner has its ${yellow} facing the front: ${say(align)}.`,
    ][n]
    if (align.length) {
      const piece = homeOfPieceAt(play(plan.cube, align), frontLeft)
      plan.add({ title: 'Turn the top', explain: rule, moves: align, focus: { pieces: [find(plan.cube, piece).slot], target: frontLeft } })
    }
    const held = [
      `No corner shows ${yellow} on top, and the front-left one has its ${yellow} facing left.`,
      `One corner shows ${yellow} on top, and it is at the front-left.`,
      `Two corners show ${yellow} on top, and the front-left one has its ${yellow} facing the front.`,
    ][n]
    const done = upCount(play(plan.cube, sune.moves)) === 4
    plan.add({
      title: `Make the ${yellow} face`,
      explain: `${held} Do the Sune: ${say(sune.moves)}. ${done ? `The whole top is ${yellow} now.` : 'Then look again.'}`,
      moves: sune.moves,
      algorithm: sune.name,
      focus: { pieces: [...TOP_CORNERS, NORMAL.U] },
    })
  }
  throw unsolvable()
}

// --- 6. Place the corners ----------------------------------------------------------------

function topCorners(cube: Cube, names: Names): Plan {
  const plan = new Plan(cube)
  const placed = (c: Cube) => TOP_CORNERS.filter((s) => inPlace(c, s))
  const allPlaced = (c: Cube) => placed(c).length === 4
  if (allPlaced(cube)) return plan
  const count = (t: string[]) => placed(play(cube, t)).length

  const all = TOP_TURNS.find((t) => count(t) === 4)
  if (all) {
    plan.add({
      title: 'Turn the top',
      explain: `Turn the top until every corner is in its right place, its colours matching the centres around it: ${say(all)}.`,
      moves: all,
      focus: { pieces: TOP_CORNERS },
    })
    return plan
  }

  // The swap keeps the corner at the front-left, looking from side v.
  const swapKeeping = (s: Slot) => {
    const v = rightOf(frontOf(s))
    return { v, moves: fromSide(cornerSwap.moves, v) }
  }

  // Best: a turn of the top that leaves exactly one corner in place.
  const ones = TOP_TURNS.filter((t) => count(t) === 1).map((t) => {
    const c = play(cube, t)
    const kept = placed(c)[0]
    const swap = swapKeeping(kept)
    const goes = allPlaced(play(c, swap.moves)) ? 1 : 2
    return { t, kept, swap, goes, cost: quarterTurns(t) + goes * quarterTurns(swap.moves) }
  })
  if (ones.length) {
    const best = ones.reduce((a, b) => (b.cost < a.cost ? b : a))
    const name = pieceName(names, best.kept)
    if (best.t.length)
      plan.add({
        title: 'Turn the top',
        explain: `Turn the top until ${name} is in its right place, its three colours matching the three centres around it: ${say(best.t)}.`,
        moves: best.t,
        focus: { pieces: [find(cube, best.kept).slot], target: best.kept },
      })
    for (let go = 1; go <= best.goes; go++)
      plan.add({
        title: 'Place the corners',
        explain: `${capital(name)} is in its right place. Do the corner swap from the ${names[best.swap.v]} side, so that corner stays put at the front-left: ${say(best.swap.moves)}. It moves the other three corners round. ${go === best.goes ? 'Every corner is in its place now.' : 'Then look again.'}`,
        moves: best.swap.moves,
        algorithm: cornerSwap.name,
        focus: { pieces: TOP_CORNERS },
      })
    return plan
  }

  // No turn of the top leaves exactly one corner in place (every turn gives two
  // or none). As the lesson says: one corner swap from any side, then one turn
  // will. Take the side that finishes soonest.
  const tries = SIDES.map((v) => {
    const p = new Plan(cube)
    const moves = fromSide(cornerSwap.moves, v)
    p.add({
      title: 'Place the corners',
      explain: `No turn of the top puts exactly one corner in its right place: each gives two or none. Do the corner swap once from the ${names[v]} side: ${say(moves)}. After that, one turn of the top will. Then look again.`,
      moves,
      algorithm: cornerSwap.name,
      focus: { pieces: TOP_CORNERS },
    })
    const rest = TOP_TURNS.some((t) => placed(play(p.cube, t)).length === 1) || allPlaced(p.cube) || TOP_TURNS.some((t) => allPlaced(play(p.cube, t)))
    if (!rest) throw unsolvable()
    p.append(topCorners(p.cube, names))
    return p
  })
  plan.append(cheapest(tries))
  return plan
}

// --- 7. Place the edges -----------------------------------------------------------------

function topEdges(cube: Cube, names: Names): Plan {
  const plan = new Plan(cube)
  const focus = { pieces: TOP_EDGES }
  const placed = (c: Cube) => SIDES.filter((v) => inPlace(c, slotOf('U', v)))
  // The corners are in place now, so the top is never turned: every edge is
  // judged against the centre below it as it is.
  for (let go = 0; go < 3; go++) {
    const ok = placed(plan.cube)
    if (ok.length === 4) return plan
    if (ok.length === 1) {
      // The edge cycle keeps the edge at the back, looking from side v.
      const v = oppositeOf(ok[0])
      const moves = fromSide(edgeCycle.moves, v)
      plan.add({
        title: 'Place the edges',
        explain: `${capital(pieceName(names, slotOf('U', ok[0])))} already matches the centre below it. Do the edge cycle from the ${names[v]} side, so that edge is at the back: ${say(moves)}. It moves the other three edges round. ${isSolved(play(plan.cube, moves)) ? 'The cube is solved.' : 'Then look again.'}`,
        moves,
        algorithm: edgeCycle.name,
        focus,
      })
    } else if (ok.length === 0) {
      // From any side, one edge matches afterwards; take the side that needs fewer goes after it.
      const goesAfter = (v: Face) => {
        const c = play(plan.cube, fromSide(edgeCycle.moves, v))
        return isSolved(play(c, fromSide(edgeCycle.moves, oppositeOf(placed(c)[0])))) ? 1 : 2
      }
      const v = SIDES.reduce((a, b) => (goesAfter(b) < goesAfter(a) ? b : a))
      const moves = fromSide(edgeCycle.moves, v)
      plan.add({
        title: 'Place the edges',
        explain: `No top edge matches the centre below it yet. Do the edge cycle once from the ${names[v]} side: ${say(moves)}. Afterwards one edge will match.`,
        moves,
        algorithm: edgeCycle.name,
        focus,
      })
    } else throw unsolvable()
  }
  if (!isSolved(plan.cube)) throw unsolvable()
  return plan
}

// --- All together ---------------------------------------------------------------------------

const METHOD: [StageGoal, (cube: Cube, names: Names) => Plan][] = [
  ['cross', cross],
  ['firstLayer', corners],
  ['secondLayer', middle],
  ['topCross', topCross],
  ['topFace', topFace],
  ['topCorners', topCorners],
  ['solved', topEdges],
]

const LESSON_OF = Object.fromEntries(LESSONS.filter((l) => l.goal).map((l) => [l.goal, l.id])) as Record<StageGoal, string>

/** The steps for a cube in the teacher's own model, named with `names`. */
export function teachCube(cube: Cube, names: Names): TeachStep[] {
  const steps: TeachStep[] = []
  for (const [stage, solve] of METHOD) {
    const plan = solve(cube, names)
    for (const s of plan.steps) steps.push({ stage, lessonId: LESSON_OF[stage], ...s })
    cube = plan.cube
  }
  return steps
}

/**
 * Solves any 3x3 the Academy's way: the white cross, the white corners, the
 * middle layer, the yellow cross, the yellow face, then the top corners and
 * edges put in place. Each step is one thing to do, explained in the colours
 * the learner sees (white on the bottom). Applying every step's moves in order
 * solves the cube; a solved cube gives no steps.
 */
export function teachSolve(state: PuzzleState): TeachStep[] {
  const { cube, names } = readState(state)
  return teachCube(cube, names)
}
