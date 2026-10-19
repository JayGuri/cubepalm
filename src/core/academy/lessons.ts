import type { StageGoal } from './stages'

// The Academy teaches the layer-by-layer method: solve one layer at a time,
// bottom to top, using a handful of short algorithms. The cube is held with the
// FIRST layer on the bottom (white) and the LAST layer on top (yellow).
//
// Every lesson comes with practice positions. A position is made by running
// `setup` on a cube whose earlier layers are already solved, and `solution` is
// a way out that uses the lesson's algorithm. The tests prove both halves, so
// "Show me" never shows a move that doesn't work.

export interface LessonCase {
  setup: string
  solution: string
}

export interface Lesson {
  id: string
  title: string
  blurb: string
  /** What the learner should do, in order. Plain sentences, no jargon left unexplained. */
  steps: string[]
  /** The stage that must be reached to finish the lesson; null for a free-practice lesson. */
  goal: StageGoal | null
  /** The goal in one plain sentence, shown above the live progress. */
  goalText: string
  algorithm?: { name: string; moves: string; hint: string }
  cases: LessonCase[]
}

const repeat = (alg: string, times: number) => Array(times).fill(alg).join(' ')

/** The undo of an algorithm: reversed, each move flipped. */
export function invertMoves(alg: string): string {
  return (alg.match(/[URFDLBMES]2?'?/g) ?? [])
    .reverse()
    .map((m) => (m.includes('2') ? m.replace("'", '') : m.endsWith("'") ? m.slice(0, -1) : `${m}'`))
    .join(' ')
}

const caseOf = (setup: string): LessonCase => ({ setup, solution: invertMoves(setup) })
const algorithmCase = (alg: string, times: number): LessonCase => ({
  setup: invertMoves(repeat(alg, times)),
  solution: repeat(alg, times),
})

const TRIGGER = "R U R' U'"
const MIDDLE_RIGHT = "U R U' R' U' F' U F"
const MIDDLE_LEFT = "U' L' U L U F U' F'"
const TOP_CROSS = "F R U R' U' F'"
const SUNE = "R U R' U R U2 R'"
const CORNERS = "R' F R' B2 R F' R' B2 R2"
const EDGES = "R U' R U R U R U' R' U' R2"

export const LESSONS: Lesson[] = [
  {
    id: 'basics',
    title: 'Meet the cube',
    blurb: 'The six faces and how a turn is written.',
    goal: null,
    goalText: 'Make any four turns.',
    steps: [
      'The cube has six faces: Right, Left, Up, Down, Front and Back, written R, L, U, D, F and B. The centre piece of a face never moves, so it tells you what colour that face will be when solved.',
      'A letter on its own means turn that face a quarter turn clockwise, as if you were looking straight at it. A ’ after the letter means turn it back the other way. A 2 means turn it twice.',
      'Try it now. Drag a layer, press a letter key such as R, U or F (add Shift for the ’ turn), tap the letter buttons on a touch screen, or use your hands. Four turns finish this lesson.',
    ],
    cases: [],
  },
  {
    id: 'cross',
    title: 'The white cross',
    blurb: 'Make a plus sign on the white face.',
    goal: 'cross',
    goalText: 'A white plus sign on the bottom, each edge matching the side colour beside it.',
    steps: [
      'Find the four white edge pieces: the ones with white and one other colour. Each belongs on the bottom, white facing down, next to the centre that matches its other colour.',
      'Take one edge at a time. Turn the face it is on to bring it down to the bottom layer, then turn the bottom face until its other colour lines up with the matching centre.',
      'There is no formula for the cross; you get better at seeing it with practice. Stuck? Press Watch it to see one way, or Step by step to be walked through it.',
    ],
    cases: [caseOf('F2'), caseOf("R F' U"), caseOf("L2 U' R2 F")],
  },
  {
    id: 'corners',
    title: 'White corners',
    blurb: 'Finish the whole white layer.',
    goal: 'firstLayer',
    goalText: 'The whole bottom layer solved: white underneath, matching colours around its sides.',
    algorithm: { name: 'The trigger', moves: TRIGGER, hint: 'Do it as one smooth motion. Six in a row bring the cube back to where it started.' },
    steps: [
      'Find a white corner in the top layer. Turn the top face until the corner sits right above its home: the bottom spot between the two centres that match its other two colours.',
      'Turn the whole cube so that spot is at the front-right, then do the trigger: Right, Up, Right back, Up back. Repeat it until the corner drops in with white facing down. That takes one, three or five goes.',
      'Do the same for the other three corners. A white corner in the bottom layer but in the wrong place? Hold it at the front-right and do the trigger once to lift it to the top, then place it.',
    ],
    cases: [algorithmCase(TRIGGER, 1), algorithmCase(TRIGGER, 3), algorithmCase(TRIGGER, 5)],
  },
  {
    id: 'middle',
    title: 'The middle layer',
    blurb: 'Slide the four middle edges into place.',
    goal: 'secondLayer',
    goalText: 'The bottom two layers solved. Only the top layer is left.',
    algorithm: {
      name: 'Edge to the right',
      moves: MIDDLE_RIGHT,
      hint: 'For an edge that goes to the left, use the mirror: U’ L’ U L U F U’ F’',
    },
    steps: [
      'Find an edge in the top layer with no yellow on it. Turn the top face until its side colour matches the centre below it, then turn the whole cube so that centre faces you.',
      'Now look at the edge’s top colour. If it matches the centre on the right, do Edge to the right. If it matches the one on the left, do the mirror version shown under it.',
      'An edge already in the middle layer but in the wrong place or flipped? Hold it at the front-right and do Edge to the right to lift it to the top, then place it again.',
    ],
    cases: [algorithmCase(MIDDLE_RIGHT, 1), algorithmCase(MIDDLE_LEFT, 1)],
  },
  {
    id: 'top-cross',
    title: 'The yellow cross',
    blurb: 'Make a plus sign on the top face.',
    goal: 'topCross',
    goalText: 'A yellow plus sign on the top face.',
    algorithm: { name: 'Cross maker', moves: TOP_CROSS, hint: 'It is the trigger from lesson 3, with Front before it and Front back after it.' },
    steps: [
      'Look only at the yellow edges on top, and ignore the corners. With the centre they make a dot, an L shape or a straight line.',
      'For a dot, do the cross maker from any side. For an L, turn the top so the L points to the back and the left. For a line, turn it so it runs left to right. Then do the cross maker.',
      'Look again and repeat until the top shows a yellow cross. A dot can take three goes.',
    ],
    cases: [algorithmCase(TOP_CROSS, 1), algorithmCase(TOP_CROSS, 2)],
  },
  {
    id: 'top-face',
    title: 'The yellow face',
    blurb: 'Turn every top corner yellow.',
    goal: 'topFace',
    goalText: 'The whole top face yellow.',
    algorithm: { name: 'The Sune', moves: SUNE, hint: 'Only the top layer changes. The two layers you solved come back as they were.' },
    steps: [
      'Count the corners that show yellow on top. If exactly one does, turn the top so it is at the front-left. If none does, turn the top until the front-left corner has its yellow facing left.',
      'Do the Sune. Then look again, use the same rule to decide how to hold it, and repeat until the whole top face is yellow.',
      'The sides of the top layer will look jumbled while you do this. That is expected; the last two lessons sort them out.',
    ],
    cases: [algorithmCase(SUNE, 1), algorithmCase(SUNE, 2)],
  },
  {
    id: 'top-corners',
    title: 'Place the corners',
    blurb: 'Move the top corners to where they belong.',
    goal: 'topCorners',
    goalText: 'Every top corner in its right place.',
    algorithm: { name: 'Corner swap', moves: CORNERS, hint: 'Keeps the front-left corner where it is.' },
    steps: [
      'A top corner is in the right place when its three colours match the three centres around it. Turn the top face until at least one is.',
      'Turn the whole cube so that corner is at the front-left and do the corner swap. It moves the other three corners round in a circle and leaves that one alone.',
      'If no corner is right, do the swap once from any side, then look again.',
    ],
    cases: [algorithmCase(CORNERS, 1), algorithmCase(CORNERS, 2)],
  },
  {
    id: 'top-edges',
    title: 'Place the edges',
    blurb: 'The last step. Solve the cube.',
    goal: 'solved',
    goalText: 'The cube solved.',
    algorithm: { name: 'Edge cycle', moves: EDGES, hint: 'Keeps the back edge where it is.' },
    steps: [
      'Turn the top face until at least one top edge matches the centre below it. If all four match, the cube is solved.',
      'Turn the whole cube so that edge is at the back and do the edge cycle. It moves the other three edges round in a circle.',
      'Look again. If the edges are not home yet, one more go with the correct edge still at the back solves the cube.',
    ],
    cases: [algorithmCase(EDGES, 1), algorithmCase(EDGES, 2)],
  },
]

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id)
export const lessonIndex = (id: string) => LESSONS.findIndex((l) => l.id === id)
