import type { StageGoal } from './stages'

// The Academy teaches the layer-by-layer method: solve one layer at a time,
// bottom to top, using a handful of short algorithms. The cube is held with the
// FIRST layer on the bottom (white) and the LAST layer on top (yellow).
//
// Every lesson comes with practice positions. A position is made by running
// `setup` on a cube whose earlier layers are already solved, and `solution` is
// a way out that uses the lesson's algorithm. The tests prove both halves, so
// "Show me" never shows a move that doesn't work.
//
// The words are for someone who has never solved a cube. Every rule in them
// (which way to hold the cube, how many goes it takes) was checked by playing
// it out on hundreds of random cubes, stage by stage, to a solved cube.

export interface LessonCase {
  setup: string
  solution: string
}

export interface Lesson {
  id: string
  title: string
  blurb: string
  /**
   * What the learner should do, in order: one thing a person can do per step,
   * in one vocabulary (face, layer, centre, edge piece, corner piece, "turn the
   * whole cube"). Moves written in [brackets] are drawn as move chips.
   */
  steps: string[]
  /** Where a beginner gets stuck, and the way out of each. */
  stuck?: { when: string; then: string }[]
  /** The stage that must be reached to finish the lesson; null for a free-practice lesson. */
  goal: StageGoal | null
  /** The goal in one plain sentence, shown above the live progress. */
  goalText: string
  /** The lesson's algorithm, and for the middle layer its mirror image for the other side. */
  algorithm?: { name: string; moves: string; hint: string; mirror?: { name: string; moves: string } }
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
    blurb: 'The pieces, the faces, and how a turn is written.',
    goal: null,
    goalText: 'Make any four turns on the big cube.',
    steps: [
      'Every face has a centre piece in its middle. Centres never move, so a centre tells you what colour its whole face will be when the cube is solved.',
      'Around the centres are edge pieces, with two colours, and corner pieces, with three. Nine pieces that turn together make a layer.',
      'Each face has a letter: R right, L left, U up (the top), D down (the bottom), F front, B back. A letter on its own means turn that face a quarter turn clockwise, as if you were looking straight at it.',
      'A ’ after the letter means turn it back the other way, and a 2 means turn it twice. Tap the letters below to watch each one.',
      'Now make four turns on the big cube: drag a layer, press a letter key (Shift and the letter for ’), tap the letter buttons under the cube, or use your hands.',
    ],
    cases: [],
  },
  {
    id: 'cross',
    title: 'The white cross',
    blurb: 'Make a white plus sign on the bottom.',
    goal: 'cross',
    goalText: 'A white plus sign on the bottom face, each edge piece’s other colour matching the centre beside it.',
    steps: [
      'Keep the white centre on the bottom. You are placing the four white edge pieces: each has white and one other colour.',
      'Find one in the top layer with white facing up. Turn the top until its other colour sits right above the centre of the same colour.',
      'Turn that face twice. The piece drops to the bottom, white facing down, next to its centre.',
      'Do the same with the other three. A piece somewhere else? Open If you are stuck below: it shows how to bring it to the top.',
    ],
    stuck: [
      {
        when: 'A white edge piece is on top, but white faces out to the side.',
        then: "Turn the whole cube so the centre of its top colour is on your right. Turn the top until the piece is at the front, white facing you. Do [F R' F'] and it drops into place.",
      },
      {
        when: 'A white edge piece is in the middle layer.',
        then: 'Turn the side face that does not show white so the piece rises into the top layer. Turn the top once to move it aside, then turn that side face back. White now faces up: place it as in step 2.',
      },
      {
        when: 'A white edge piece is on the bottom, in the wrong place or with white facing out.',
        then: 'Turn that side face twice to lift it into the top layer, then place it.',
      },
      {
        when: 'A piece you placed came out again.',
        then: 'It is in the top or middle layer now. Bring it back the same way; the goal counts only pieces in place.',
      },
    ],
    cases: [caseOf('F2'), caseOf("R F' U"), caseOf("L2 U' R2 F")],
  },
  {
    id: 'corners',
    title: 'White corners',
    blurb: 'Finish the whole white layer.',
    goal: 'firstLayer',
    goalText: 'The whole bottom layer solved: white underneath, matching colours around its sides.',
    algorithm: { name: 'The trigger', moves: TRIGGER, hint: 'Do it as one smooth motion. Six in a row bring the cube back to where it started, so you cannot get lost.' },
    steps: [
      'Find a white corner piece in the top layer. Its home is the bottom corner between the centres of its two other colours.',
      'Turn the top until the piece sits right above its home. Then turn the whole cube so that home is at the front-right.',
      "Do the trigger, [R U R' U'], and look. Repeat it until the piece drops in with white facing down: that takes one, three or five goes.",
      'Place the other three white corner pieces the same way.',
    ],
    stuck: [
      {
        when: 'A white corner piece is on the bottom, but in the wrong place or twisted.',
        then: 'Turn the whole cube so it is at the front-right and do the trigger once. That lifts it into the top layer; then place it.',
      },
      {
        when: 'The piece does not drop in.',
        then: 'Check it is right above its home: its two side colours must match the centres beside that spot. Then keep going; it can take five triggers.',
      },
    ],
    cases: [algorithmCase(TRIGGER, 1), algorithmCase(TRIGGER, 3), algorithmCase(TRIGGER, 5)],
  },
  {
    id: 'middle',
    title: 'The middle layer',
    blurb: 'Slide the four middle edge pieces into place.',
    goal: 'secondLayer',
    goalText: 'The bottom two layers solved. Only the top layer is left.',
    algorithm: {
      name: 'Edge to the right',
      moves: MIDDLE_RIGHT,
      hint: 'Each takes the edge piece from the top of the front face down into the middle layer, and puts the bottom layer back as it was.',
      mirror: { name: 'Edge to the left', moves: MIDDLE_LEFT },
    },
    steps: [
      'Find an edge piece in the top layer with no yellow on it.',
      'Turn the top until the colour on its side matches the centre below it. Turn the whole cube so that centre faces you.',
      'Look at the piece’s top colour. If it matches the centre on the right, do Edge to the right. If it matches the centre on the left, do Edge to the left.',
      'Do the same for the other middle edge pieces.',
    ],
    stuck: [
      {
        when: 'Every edge piece in the top layer has yellow on it.',
        then: 'A middle edge piece is in the wrong place or flipped. Turn the whole cube so it is at the front-right and do Edge to the right once to lift it out. Then place it.',
      },
    ],
    cases: [algorithmCase(MIDDLE_RIGHT, 1), algorithmCase(MIDDLE_LEFT, 1)],
  },
  {
    id: 'top-cross',
    title: 'The yellow cross',
    blurb: 'Make a yellow plus sign on the top face.',
    goal: 'topCross',
    goalText: 'A yellow plus sign on the top face.',
    algorithm: { name: 'Cross maker', moves: TOP_CROSS, hint: 'It is the trigger from lesson 3, with Front before it and Front back after it.' },
    steps: [
      'Look only at the top face: its centre and the four edge pieces. Ignore the corners. The yellow there makes a dot, an L or a line.',
      'Turn the top to hold it as the picture shows: the L at the back and the left, the line from left to right. A dot can be held any way.',
      'Do the cross maker and look again. Repeat until the top shows a yellow plus sign: a line takes one go, an L two, a dot three.',
    ],
    cases: [algorithmCase(TOP_CROSS, 1), algorithmCase(TOP_CROSS, 2)],
  },
  {
    id: 'top-face',
    title: 'The yellow face',
    blurb: 'Turn every top corner yellow side up.',
    goal: 'topFace',
    goalText: 'The whole top face yellow.',
    algorithm: { name: 'The Sune', moves: SUNE, hint: 'Only the top layer changes. The two layers you solved come back as they were.' },
    steps: [
      'Count the corner pieces that show yellow on top: none, one or two.',
      'Turn the top to hold it as the picture for that number shows. One: that corner at the front-left. None: the front-left corner’s yellow facing left. Two: the front-left corner’s yellow facing you.',
      'Do the Sune and count again. Repeat until the whole top face is yellow; it never takes more than three goes.',
      'The sides of the top layer will look jumbled. That is expected: the last two lessons sort them out.',
    ],
    stuck: [
      {
        when: 'After the Sune there is still one yellow corner.',
        then: 'That is normal. Put it at the front-left again and do the Sune once more.',
      },
    ],
    cases: [algorithmCase(SUNE, 1), algorithmCase(SUNE, 2)],
  },
  {
    id: 'top-corners',
    title: 'Place the corners',
    blurb: 'Move each top corner to where it belongs.',
    goal: 'topCorners',
    goalText: 'Every top corner in its right place.',
    algorithm: { name: 'Corner swap', moves: CORNERS, hint: 'It keeps the front-left corner where it is and moves the other three round.' },
    steps: [
      'A top corner piece is in its right place when its two side colours match the centres beside it. Yellow is on top already.',
      'Turn the top until exactly one corner piece is in its right place: one, not two. Then turn the whole cube so that corner is at the front-left.',
      'Do the corner swap. Look again: if the other three are not home yet, do it once more.',
    ],
    stuck: [
      {
        when: 'Every turn of the top gives two right corners, or none.',
        then: 'Do the corner swap once from any side. After that, one turn of the top gives exactly one.',
      },
    ],
    cases: [algorithmCase(CORNERS, 1), algorithmCase(CORNERS, 2)],
  },
  {
    id: 'top-edges',
    title: 'Place the edges',
    blurb: 'The last step. Solve the cube.',
    goal: 'solved',
    goalText: 'The cube solved.',
    algorithm: { name: 'Edge cycle', moves: EDGES, hint: 'It keeps the back edge piece where it is and moves the other three round.' },
    steps: [
      'Do not turn the top now: the corners are home. A top edge piece is in its right place when its side colour matches the centre below it.',
      'Turn the whole cube so a right edge piece is at the back, and do the edge cycle.',
      'Look again. If the cube is not solved, do the edge cycle once more with the same piece at the back. That solves it.',
    ],
    stuck: [
      {
        when: 'No top edge piece is in its right place.',
        then: 'Do the edge cycle once from any side. After that, one is.',
      },
    ],
    cases: [algorithmCase(EDGES, 1), algorithmCase(EDGES, 2)],
  },
]

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id)
export const lessonIndex = (id: string) => LESSONS.findIndex((l) => l.id === id)
