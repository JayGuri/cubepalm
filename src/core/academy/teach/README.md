# The teaching solver

`teachSolve(state)` solves any 3x3 the way the Academy teaches it — the
layer-by-layer method, white cross first, yellow edges last — and returns the
whole solve as a list of `TeachStep`s, each one thing a beginner can do, in
the words `lessons.ts` already uses. `practicePosition(lessonId, below?)`
gives a random, real-looking practice cube for one lesson.

## The method, case by case

Each stage below is one of `stages.ts`'s `StageGoal`s and one lesson. `teach.ts`
has one function per stage; each repeatedly finds the next piece to place and
emits the steps for it, trying moves on a private copy of the cube
(`cube.ts`'s `Cube`, a 54-sticker array) before saying anything.

1. **White cross** (`cross`). One white edge at a time, by the case a beginner
   can see: already on the bottom but wrong or flipped (a half turn of its
   side lifts it out); in the middle layer with its side colour already next
   to the matching centre (one turn drops it in); in the middle layer the
   other way round (lift it out with the face its colour is on — moving a
   placed white edge out of the way and back again first, if that face
   already has one); on top, white facing up (line up the top, then a half
   turn); on top, white facing out (line up the top so the edge sits above the
   centre to its right, then `F R' F'`).
2. **White corners** (`firstLayer`). A corner in the bottom layer but wrong or
   twisted is lifted out with one trigger (`R U R' U'`) from its side. Once a
   corner is on top, the top is turned until it sits above its home, then the
   trigger is done from that side once, three or five times — whichever
   drops it in white-down.
3. **Middle layer** (`secondLayer`). A middle edge sitting wrong or flipped is
   lifted out with Edge to the right from its side. Once an edge is on top, the
   top is turned until its side colour sits above the matching centre, and
   Edge to the right or Edge to the left is used depending on which side the
   edge's top colour is on.
4. **Yellow cross** (`topCross`). The dot/L/line case from the lesson, turning
   the top to hold an L at the back-left or a line left-to-right (a dot is
   done from any side), then the cross maker (`F R U R' U' F'`); up to three
   times.
5. **Yellow face** (`topFace`). The Sune (`R U R' U R U2 R'`) with the
   none/one/two hold rule from the lesson, up to three times (proved by
   `explore.test.ts`'s exhaustive search over every valid hold: no sequence of
   legal holds ever takes more than three).
6. **Place the corners** (`topCorners`). If a turn of the top leaves exactly
   one corner in place, the corner swap (`R' F R' B2 R F' R' B2 R2`) is done
   from that corner's side, once or twice. No turn ever leaves exactly one in
   place for two particular cases (no corners right, or two opposite
   corners right): the lesson's fallback — one swap from any side — always
   turns that into the first case, so the solver tries each side and keeps
   the cheapest.
7. **Place the edges** (`solved`). The edge cycle
   (`R U' R U R U R U' R' U' R2`) from the side of the one matching edge
   (if none match, once from any side first).

Every "from the side" move is the lesson's own algorithm relabelled for a
whole-cube turn about the vertical axis — `fromSide()` in `cube.ts` cycles
F→R→B→L→F through the move letters, which is exactly what holding the cube
turned does to U/D turns too (they're untouched). `teach.test.ts` checks every
relabelling of every lesson algorithm (and 20 random sequences) against
actually turning the cube that way with cubing.js, for all four sides.

## Colours as the learner sees them

The Academy shows the cube flipped from the app's internal colouring: white
and yellow trade places, and so do green and blue (`FreePlay.tsx`'s
`FLIP_COLORS`). `cube.ts` exports the same mapping as `ACADEMY_REMAP` and
`academyColourName()`, and `readState()` returns both the cube and a `Names`
map (face → the colour name shown there) for the cube actually being solved —
so a cube whose centres were moved by slice turns or rotations is still
narrated correctly.

## `focus`

`focus.pieces` are the slots (at the step's start) of every piece the step's
text mentions — the piece being moved, and any centre named ("the red
centre"). `focus.target` is where the moving piece is headed, when the step
has one destination piece. The UI can dim everything else with
`PuzzleCanvas`'s `focusSlots`.

## Guarantees, and what proves them (`teach.test.ts`)

- **It solves the cube.** For thousands of seeded random cubes (built by
  `practice.ts`'s `randomCube`, cubie-level, uniform over real positions),
  applying every step's moves in order reaches solved — checked both on the
  teacher's own model and, separately, by replaying the same moves through
  the real `PuzzleState`/cubing.js and the Academy's own `stageDone`.
- **Each stage finishes, and stays finished.** After a stage's last step,
  `stageDone` holds for it; after every step, every earlier stage still holds.
- **`focus` is real.** Every slot is a real cube position; every piece the
  text names (by its colours) is actually one of the slots in focus.
- **No wrong colours.** A step's text never names a colour that isn't on one
  of the pieces in focus — checked by scanning the explanation for colour
  words and the "the X and Y edge"/"the X, Y and Z corner" phrases the
  teacher itself generates.
- **Algorithms work from every side**, proven against cubing.js (above).
- **`practicePosition` gives the lesson a real, unfinished position**: for
  every lesson, a hundred seeded draws are replayed through cubing.js and
  checked against the Academy's own `stageDone` — every earlier stage solved,
  the lesson's own not.
- **`practicePosition` is uniform.** For the top layer (11 edge arrangements,
  23 corner arrangements, 26 corner-twist patterns), every reachable
  unfinished state is hit, and a chi-square check against an equal spread
  passes comfortably. For a single free piece in an earlier stage (an edge or
  corner not yet placed), every slot and every way round comes up equally
  often, checked the same way. The construction (`practice.ts`'s
  `randomCube`): shuffle the free corners, shuffle the free edges, swap two
  free edges if that leaves the parities disagreeing (pairing every odd
  arrangement with exactly one even one, keeping both uniform), then twist or
  flip the pieces inside the lesson's own "may move" set — the last one forced
  so the total comes out a multiple of 3 (corners) or even (edges), as every
  real cube's does. A draw where the lesson's stage is already done is
  rejected and redrawn, which leaves the rest uniform (it is thinning a
  uniform distribution). `below` defaults to the Web Crypto generator; tests
  pass a seeded `below` so a run can be reproduced.
- **`practicePosition('basics', …)`** returns `""`: Meet the cube has no goal,
  and a solved cube is the clearest start for seeing what a turn does.

## Performance

Measured with 2000 random cubes (`src/core/academy/teach/explore.test.ts`,
run alone, no other load):

| Stage | Median face turns | Worst seen |
|---|---|---|
| White cross | 11 | 19 |
| White corners | 44 | 84 |
| Middle layer | 35 | 60 |
| Yellow cross | 13 | 19 |
| Yellow face | 16 | 24 |
| Place the corners | 10 | 19 |
| Place the edges | 22 | 22 |
| **Total** | **146** (158 quarter turns) | 210 |
| Steps | 30 | 40 |

Time per `teachSolve` call: **median 4.6 ms, 95th percentile ~14 ms, worst
seen ~110 ms** (on a shared, busy machine; alone it does not exceed ~30 ms).
No tables are built and nothing touches the network — it is a few thousand
array operations on a 54-byte cube, tried out before being said.

The method is not move-optimal (a human method isn't trying to be); it is
optimised for being explainable one case at a time. If the UI ever wants a
shorter demonstration solve, that is what the existing Kociemba solver is for.
