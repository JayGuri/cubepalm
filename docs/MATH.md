# The math behind CubePalm

A from-scratch tour of every piece of mathematics this project uses, in the
order you'd need it to build the app yourself. No background assumed beyond
school algebra. Each section ends with **where it lives in the code**.

1. [Describing a cube with numbers](#1-describing-a-cube-with-numbers)
2. [How many ways can a cube be scrambled?](#2-how-many-ways-can-a-cube-be-scrambled)
3. [Moves are permutations: a little group theory](#3-moves-are-permutations-a-little-group-theory)
4. [Turning a layer in 3D: vectors, the right-hand rule, quaternions](#4-turning-a-layer-in-3d)
5. [Drawing it: cameras, projection, and orbiting](#5-drawing-it-cameras-projection-and-orbiting)
6. [Turning a mouse drag into a move](#6-turning-a-mouse-drag-into-a-move)
7. [Reading your hands](#7-reading-your-hands)
8. [The Kociemba algorithm](#8-the-kociemba-algorithm)
9. [The guided solve](#9-the-guided-solve)
10. [Colour](#10-colour)
11. [The Mirror Cube](#11-the-mirror-cube)

---

## 1. Describing a cube with numbers

Put the cube's centre at the origin and give it three axes:

```
        y (up, the U face)
        |
        |
        +------ x (right, the R face)
       /
      z (towards you, the F face)
```

A 3x3 is a 3×3×3 grid of little cubes ("cubies"). Each sits at a position
`(x, y, z)` where every coordinate is `-1`, `0` or `1`:

- **Corners** have no zeros, e.g. `(1, 1, 1)` is the up-front-right corner. There are 2×2×2 = **8**.
- **Edges** have exactly one zero, e.g. `(1, 1, 0)` is the up-right edge. There are **12**.
- **Centres** have two zeros, e.g. `(0, 1, 0)` is the U centre. There are **6**.
- `(0, 0, 0)` is the hidden core — no cubie there, so 8 + 12 + 6 = **26** pieces.

A **layer** is every cubie sharing one coordinate value. The R face is "all
cubies with `x = 1`"; the middle slice M is "all cubies with `x = 0`". That one
idea, *a layer is a coordinate held fixed*, drives the animation, the move
preview, and the guide's arrow.

| Letter | Layer | Outward direction / position |
|---|---|---|
| R / L | Right / Left | +x / −x |
| U / D | Up / Down | +y / −y |
| F / B | Front / Back | +z / −z |
| M / E / S | the three middle slices | x = 0 / y = 0 / z = 0 |

**In the code:** `src/core/puzzles/cube3/geometry.ts` (`FACE_NORMALS`,
`slotOf`, `facesOfSlot`), and every `slot: [x, y, z]` you see.

---

## 2. How many ways can a cube be scrambled?

Count it in pieces.

**Corners.** 8 corners can be arranged in `8!` orders (8 choices for the first
spot, 7 for the next, …): `8! = 40,320`. Each corner can also be twisted 3 ways:
`3⁸`.

**Edges.** Likewise `12!` arrangements and `2¹²` flips.

That gives `8! · 3⁸ · 12! · 2¹²` — but not all of those are reachable by
turning, because three rules hold after every legal turn:

1. **Total corner twist is always a multiple of 3.** Fix any 7 corners' twists and the 8th is forced: divide by 3.
2. **Total edge flip is always even.** Divide by 2.
3. **Permutation parity.** A quarter turn moves four corners round in a cycle and four edges round in a cycle. A 4-cycle is an *odd* rearrangement (it equals three swaps), so every quarter turn flips the corners' parity and the edges' parity *together*. They can never differ: divide by 2.

```
8! · 3⁸ · 12! · 2¹²
-------------------  =  43,252,003,274,489,856,000  ≈ 4.3 × 10¹⁹
     3 · 2 · 2
```

That's the "43 quintillion states" on the home page. (Take a cube apart and
reassemble it randomly and there are 12× more arrangements — 11 out of every
12 are unsolvable, precisely because of those three rules.)

A famous related fact: **every one of those positions can be solved in at most
20 moves** ("God's number", proved by computer in 2010).

---

## 3. Moves are permutations: a little group theory

Number the 54 coloured stickers. A move like `R` doesn't create or destroy
stickers — it **rearranges** them. A rearrangement is a **permutation**, and
permutations have a tidy algebra:

- **Composition.** Doing `R` then `U` is itself one rearrangement, written `R U`.
- **Identity.** Doing nothing.
- **Inverses.** Every move can be undone: `R R' = identity`.
- **Order.** Four `R`s bring you back: `R⁴ = identity`.

A set with these properties is a **group**. The Rubik's Cube group is the set of
all 43 quintillion positions, with "do one move sequence after another" as the
operation. Three consequences show up directly in this app:

- `R' = R³` — counter-clockwise equals three clockwise turns. (Your reference
  project relied on this; here the left hand makes `R'` directly.)
- `R2 = R R` — why the guide splits a double turn into two steps.
- **The inverse of a sequence is the reverse of the inverses:**
  `(R U)' = U' R'`. To undo putting on socks then shoes, you take off the shoes
  first. This is how Undo walks back through your history.

**Notation.** The letter names the layer; no mark means clockwise *as seen when
looking straight at that face from outside*; `'` means counter-clockwise; `2`
means a half turn. The slices follow a neighbour: M turns like L, E like D,
S like F.

**In the code:** the permutation algebra is done by the `cubing.js` library
(`KPuzzle`/`KPattern`), wrapped in `src/core/puzzles/cube3/logic.ts`. It's never
hand-rolled — it's the single source of truth every test checks against.

---

## 4. Turning a layer in 3D

### Vectors and the right-hand rule

A **vector** is an arrow: `(1, 0, 0)` points along +x. A rotation needs an
**axis** (a vector) and an **angle**. The sign of the angle follows the
**right-hand rule**: point your right thumb along the axis, and your fingers
curl in the *positive* direction.

A subtlety here caused a real bug. "Clockwise" in cube notation means clockwise
**when you look at the face from outside**. For `R` you look from the right,
i.e. back *down* the +x axis toward the centre. From that viewpoint the
right-hand rule's positive direction looks **counter-clockwise**. So:

```
R  (clockwise from outside)  =  rotation by −90° about +x
L  (clockwise from outside)  =  rotation by +90° about +x   (you look from −x)
```

Faces on the negative side (L, D, B) flip sign because you view them from the
other end of the same axis. Get this wrong and the animation shows one
direction while the cube actually does the opposite — the "animation says U,
cube does U'" bug fixed early on.

### Quaternions: smooth rotation

To animate a turn, every cubie in the layer is rotated by a growing angle each
frame. Rotations are stored as **quaternions**, four numbers:

```
q = ( cos(θ/2),  sin(θ/2)·aₓ,  sin(θ/2)·a_y,  sin(θ/2)·a_z )
```

for a rotation by angle θ about a unit-length axis `a`. They never get stuck the
way three separate angles can ("gimbal lock"), they combine cheaply, and they're
what the 3D engine (three.js) uses internally.

### Easing

A turn that starts and stops at full speed looks robotic. The fraction of the
turn completed at time `t` (0 to 1) goes through an **ease-in-out** curve:

```
ease(t) = 2t²               for t < ½
        = 1 − (−2t + 2)² / 2  for t ≥ ½
```

Slow start, fast middle, gentle stop. A quarter turn takes 220 ms.

**In the code:** `src/core/animation/parseCubeMove.ts` (notation → axis, layer,
signed angle), and the `useFrame` loop in `src/components/PuzzleCanvas.tsx`
(`setFromAxisAngle`, `easeInOutQuad`). The guide's gold arrow
(`src/components/MoveArrow.tsx`) reuses the same axis and angle, so it can't
disagree with the real turn.

---

## 5. Drawing it: cameras, projection, and orbiting

### Projection

The screen is flat; the cube isn't. A **perspective camera** maps each 3D point
to the screen by dividing by its depth, so distant things shrink. The result is
in **normalized device coordinates (NDC)**, where the screen runs from −1 to +1
in both directions.

### Raycasting

Going the other way: a mouse click is a 2D point. Shoot a **ray** from the
camera through that point and find the first triangle of the cube it hits. That
tells you which cubie, and which face of it, you clicked.

### Orbiting with spherical coordinates

When you orbit, the camera slides over an imaginary sphere around the cube. A
point on a sphere is easier to describe with **spherical coordinates**:

- `r` — distance from the cube (zoom),
- `θ` (theta) — angle around the vertical axis (left–right orbit),
- `φ` (phi) — angle down from straight above (up–down orbit).

Orbiting by hand nudges `θ` and `φ` by the hand's movement × a sensitivity;
zooming changes `r`. `φ` is kept a little away from 0 and π so the camera can't
flip over the top. The sign of the `θ` nudge makes **the cube turn the way your
hand moves**, and its test is written from your point of view: after a rightward
hand movement, the front of the cube must slide right on screen.

**In the code:** `src/core/gestures/handOrbit.ts` (and its test), `nudgeZoom`
in `PuzzleCanvas.tsx`, three.js's `Spherical`.

---

## 6. Turning a mouse drag into a move

You click a sticker and drag. Which layer turns, and which way?

1. **Which face did you grab?** Raycasting gives its outward normal, e.g. `(0, 0, 1)` = front.
2. **Which way did you drag?** Project each 3D axis onto the screen to see which screen direction it points. Compare your drag with each using the **dot product** `a·b = aₓbₓ + a_y b_y`; the larger it is, the more the drag lines up with that axis.
3. **Around which axis does the layer rotate?** The one perpendicular to both the face normal and your drag — exactly what the **cross product** `normal × drag` gives. Grab the front and drag right: the axis is vertical, so a horizontal layer turns.
4. **Which layer?** The grabbed cubie's coordinate along that axis: 1, 0 or −1. Zero means a middle slice.
5. **Which direction?** The signs from steps 2–4, corrected for the "clockwise from outside" rule in section 4.

**In the code:** `src/core/gestures/MouseDragAdapter.ts` (`moveFromDrag`).

---

## 7. Reading your hands

### Landmarks

Google's **MediaPipe Hands** model finds **21 points** ("landmarks") on each
hand in each camera frame: the wrist and four joints per finger. Each is
`(x, y, z)`, with x and y as fractions of the image (0 to 1) and z a rough depth.
It also reports which hand it thinks it is, and how confident it is.

### Making it size-independent

Your hand looks bigger near the camera. So every distance is divided by a
**hand scale**: wrist to the base of the middle finger. "The fingertip is 1.9
hand-lengths from the wrist" then means the same at any distance. This is
**normalisation**.

### Is a finger up?

A finger counts as **extended** when its tip is more than `1.4` hand-scales from
the wrist (`extendedRatio`); a curled tip sits much closer.

### Poses as binary numbers

Index, middle, ring, pinky — four yes/no answers make a 4-bit binary number, so
`2⁴ = 16` poses:

| Pose | Fingers | Meaning |
|---|---|---|
| `1111` | all up | open hand → orbit |
| `0000` | none up | fist → lock |
| 9 of the other 14 | | the nine layers |

The thumb is ignored — it's the least reliable finger to track. The **hand**
adds one more bit, right or left = clockwise or counter-clockwise, so
9 poses × 2 hands = **all 18 quarter turns**.

### Filtering out flicker: a majority vote

A tracker can misread a single frame. If each frame is wrong with probability
`p`, independently, how likely is a wrong pose to win **4 of the last 6** frames?
A binomial sum:

```
P(≥4 wrong of 6) = C(6,4)·p⁴(1−p)² + C(6,5)·p⁵(1−p) + p⁶
```

With a fairly bad `p = 0.1`, that's about **0.0013** — roughly one false pose in
800 windows, against one in every 10 frames without the vote. On top of that,
a pose must be **held** for 550 ms, and it only fires on a frame where the hand
is actually showing it.

### State machines

Each hand is a small **finite state machine**: *nothing recognised* → *pose
recognised, timing the hold* → *fired* (relax to re-arm). The fist lock is a
second, independent one. State machines turn a noisy stream of frames into
clean, one-at-a-time decisions.

**In the code:** `src/core/gestures/landmarkMath.ts` (`handScale`,
`fingerCurl`), `src/core/gestures/signGestures.ts` (poses, voting, holds),
`src/core/gestures/fistLock.ts`.

---

## 8. The Kociemba algorithm

### The problem

Find a short sequence of moves from a scramble back to solved. Each position has
18 possible next moves, so sequences of length 20 number up to
`18²⁰ ≈ 1.3 × 10²⁵`. You cannot try them all.

### Idea 1: search with a good estimate (IDA*)

Picture a tree: the root is your position, each branch a move. **Iterative
deepening A\*** (IDA\*) explores it depth-first, pruning any branch where

```
f = g + h  >  current limit
```

- `g` = moves made so far,
- `h` = an **estimate** of the moves still needed.

If `h` **never overestimates** (it is *admissible*), no branch that could finish
within the limit is ever thrown away. Raise the limit one move at a time and the
first solution found is the shortest. Everything depends on a good `h`.

### Idea 2: pruning tables

For a simplified *part* of the cube — say just the corner twists, `3⁷ = 2,187`
possibilities — you can compute the **exact** fewest moves for every
possibility ahead of time (a breadth-first search) and store them in a table.
Fixing part of the cube can never take more moves than fixing all of it, so a
table lookup is an admissible `h`. Building these tables is the ~0.9 s warm-up
the app does in a background worker at start-up.

### Idea 3: two phases (Kociemba, 1992)

Searching all 4.3 × 10¹⁹ states at once is still too slow. Herbert Kociemba
split the problem using a **subgroup**: the positions reachable using only

```
G₁ = ⟨ U, D, R2, L2, F2, B2 ⟩
```

— quarter turns of the top and bottom, only half turns of the sides. These moves
never twist a corner, never flip an edge, and never move the four middle-layer
edges out of the middle layer.

**Phase 1 — get into G₁.** Only three things need fixing:

| Coordinate | What it measures | Possibilities |
|---|---|---|
| corner twist | orientation of the 8 corners | 3⁷ = 2,187 |
| edge flip | orientation of the 12 edges | 2¹¹ = 2,048 |
| slice | which 4 slots hold the middle-layer edges | C(12,4) = 495 |

About 2.2 billion combinations, small enough for good tables. Never more than
12 moves.

**Phase 2 — finish inside G₁.** Orientations are already right; only
arrangements remain:

| Coordinate | Possibilities |
|---|---|
| corner arrangement | 8! = 40,320 |
| top/bottom-layer edge arrangement | 8! = 40,320 |
| middle-layer edge arrangement | 4! = 24 |

Never more than 18 moves.

Each phase is a far smaller search than the whole cube. The catch: the fastest
phase 1 can leave a long phase 2. A full implementation keeps trying longer
phase-1 solutions to shrink the **total**, landing very close to optimal
(usually 18–22 moves) in well under a second.

### What this app's solver actually does

CubePalm's solver is written from scratch (`src/core/solvers/twoPhase.ts`). It was
first built on an off-the-shelf package, which stopped at the **first** good
solution it found: typically 20 to 23 moves on a real scramble, and silly on a
cube only a few turns from solved (three turns came back as 21).

The replacement follows the two-phase recipe above and then keeps going:

1. **Coordinates.** A cube is reduced to six small numbers: corner twist
   (3^7 = 2187), edge flip (2^11 = 2048) and slice position (C(12,4) = 495) for
   phase 1; corner permutation (8! = 40320), edge permutation (8!) and slice
   permutation (4! = 24) for phase 2. Permutations are numbered with a Lehmer
   code, the position of a permutation in the list of all n! of them.
2. **Move tables.** For each coordinate, a table that says what number you get
   after each of the 18 turns. The search never touches a 3D cube again; it just
   looks numbers up.
3. **Pruning tables.** A search outward from the goal over pairs of
   coordinates records the exact number of **steps** still needed, where a
   quarter turn costs 1 and a half turn costs 2 (what the guide counts). Used
   as the estimate `h` in IDA*, it never over-estimates, so cutting a branch
   whose `h` exceeds what is left to spend can't lose a solution. Building all
   four tables takes about a second, done once in a web worker.
4. **Keep improving.** Both phases are searched by *cost*, not by number of
   moves: phase 1 at threshold 0, 1, 2, ... steps, and every phase-1 ending is
   handed to phase 2, bounded by the best total so far. Anything that isn't
   strictly cheaper is cut, so the answer only ever gets better until the time
   budget runs out. A third phase-1 table, corner twist x edge flip (4.5 million
   entries), tightens the estimate and cuts the search by about 40%.
5. **Six points of view, side by side.** The same cube is solved six ways:
   relabelled by a 3-fold turn about the URF corner (0, 1 or 2 times, so the
   cube is seen from three sides) and also as its **inverse**. If `S` solves the
   inverse of the scramble, then `S'` solves the scramble, by
   `(A B)' = B' A'` from section 3. The six searches advance together, one cost
   level at a time, so the cheap levels of every view are tried before the
   expensive levels of any.
6. **Proving optimality.** Two-phase answers are short, not always shortest. A
   second search is plain IDA* over the whole cube. Its estimate is the largest
   of several exact partial answers: the three phase-1 tables, the corner
   permutation (40,320 states), the places of six edges (1.7 million), and the
   places of the four slice edges. Each is exact for part of the cube, so the
   largest never over-estimates. IDA* tries cost 0, 1, 2, ... in order, so the
   first solution it finds is the cheapest that exists. Either it finds
   something cheaper than the two-phase answer, or it exhausts every cheaper
   cost, which **proves** that answer optimal. When all the estimates are 0 the
   cube must be solved: every corner and ten edges are placed, and the last two
   edges cannot be swapped alone without breaking the parity the corners fix.
   The proof is instant up to about 8 steps from solved, usually under a second
   at 10 to 12, and out of reach for a full scramble (hours), so it is used
   where it works: lightly scrambled cubes and the end of every guided solve.

Cost is measured in **quarter turns** (`R2` counts as 2), because that is how
many sign, key or drag actions a person makes. Measured on random scrambles:
the very first answer averages about 32 steps; after three seconds of search, about 24.4. No position needs more than 26 (the quarter-turn "God's number").

Slice turns (M E S) and rotations (x y z) in a history are rewritten as face
turns plus a whole-cube rotation (`M = R L' x'`, and so on). A rotation never
changes how scrambled a cube is, only which face we call Up, so the solver keeps
a relabelling table (`frame.ts`) instead of rotating anything, and relabels its
answer on the way out.

On top of the search, the app also tries a second, always-valid route: **undo
your moves in reverse**, with cancelling moves merged (`R R'` disappears,
`R R` becomes `R2`). It keeps whichever route takes fewer quarter turns, so you
never get a long answer when a short undo exists. Neither route is guaranteed to
be the true shortest: that needs an optimal solver (Korf's), which takes minutes
and gigabytes. Two-phase answers land within a couple of moves of optimal.

**Honesty check:** the tests apply every solution to a cube in `cubing.js`, an
independent implementation, and require it to be solved, for random scrambles,
for the superflip, and for cubes made with slice turns and rotations.

### Searching while you play

The first route comes back in about 0.4 seconds, so Guide me never makes you
wait. A better one is then looked for in the background:

- **It starts early.** The search begins the moment a scramble lands, so by the
  time you press Guide me it has usually beaten the first route.
- **It is resumable.** The search keeps its own stack and runs in 30 ms slices,
  so it can be told to stop or to tighten its target within a blink.
- **It is spread over cores.** Up to four helper workers each take some of the
  six views and tell each other every new best cost. One of them finishing all
  its cost levels proves the route optimal, because every solution passes through
  the simpler family of positions at its last entry into it.
- **It restarts at every move you make.** Following the guide, each correct turn
  shortens the remaining route by one step. The search restarts from your new
  cube with "beat what is left" as its target, and swaps the guide to the new
  route when it finds a shorter one. A wrong turn is recovered by undoing it
  first, instantly, with no waiting for a new search.
- **It can only help.** The target is always the route already in hand, so the
  guide never gets longer, and the route is never longer than undoing the
  scramble in the same units (quarter turns).

**Something that did not help.** A natural next idea is a peephole pass: any
stretch of the answer is itself a small cube, so replace each stretch of up to
11 quarter turns by its provably shortest equivalent. It works (it turns
`R U U U R` into `R U' R`), but on random scrambles it gained nothing: the
average stayed at 24.9 before and after, because two-phase answers are already
shortest over every stretch that short. Stretches long enough to matter are too
slow to prove. It was removed rather than kept as dead weight.

### Random scrambles

A scramble is not a random string of moves, which would favour some cubes over
others. It is a **random state**: pick a corner arrangement and an edge
arrangement at random, make their parities agree, pick twists that sum to a
multiple of 3 and flips that sum to a multiple of 2, and you have one of the
43,252,003,274,489,856,000 reachable cubes with equal chance. The solver then
solves that cube, and the solution played backwards is the scramble. The random
numbers come from the browser's cryptographic generator, with the uneven tail
rejected so every value is equally likely.

**In the code:** `twoPhase.ts` (tables and search), `frame.ts` (slices and
rotations), `kociembaCore.ts` (entry point), `kociemba.worker.ts` (runs it off
the main thread), `kociemba.ts` (`solveFromHistory`, which also tries the undo).

---

## 9. The guided solve

1. **Scramble** applies random moves.
2. The solver returns a sequence like `R U2 F' …`.
3. Each step is one **quarter turn**, because that's what one sign or key makes:
   `U2` (and the equivalent `U2'`) becomes `U, U` — just `X2 = X X` from section 3.
4. When you make a move it's compared to the next step. Match → advance. No
   match → **re-solve** from where the cube actually is, so the remaining steps
   are a fresh solution from your real position.
5. "Solved!" appears only once every queued turn has finished **and** the cube
   really is solved.

**In the code:** `src/core/solvers/solveGuide.ts`, and the guide section of
`src/components/screens/FreePlay.tsx`.

**Solve for me** uses the same solution but plays it back: a player lets you
pause, step either way (stepping back applies the inverse move, `X'`) and speed
it up, so the animation time per turn is simply divided by 1, 2 or 4.

---

## 9b. The Academy

The lessons teach the layer-by-layer method. Each stage is a yes/no question
asked of the cube (`src/core/academy/stages.ts`): "is every white edge in its
place?" A piece is in place when each of its stickers matches the centre of the
face it sits on. Centres never move on face turns, so they are the reference.

Every practice position is built with group theory. Take an algorithm `A` that
fixes a stage. Applying `A'` to a solved cube makes a position `A` repairs, and
applying `A` repeated `n` times is how the lesson says to get out of it:
`(A')^n` is undone by `A^n`. The tests check that each position starts
unfinished, keeps the earlier layers intact, and that the lesson's solution
finishes it, so "Show me" can never show a move that doesn't work.

---

## 10. Colour

Colours are stored as RGB (red, green, blue, 0–255), but how different two
colours *look* is better judged by **hue**, the angle around the colour wheel
(red 0°, yellow 60°, green 120°, …). For a colour whose largest channel is red,
hue ≈ `60° × (G − B) / (max − min)`.

| Colour | RGB | Hue |
|---|---|---|
| Red sticker `#C41E3A` | 196, 30, 58 | ≈ 350° (crimson) |
| Old orange `#FF5800` | 255, 88, 0 | 60 × 88/255 ≈ **21°** |
| New orange `#FF8A00` | 255, 138, 0 | 60 × 138/255 ≈ **32°** |

The old orange sat only about 31° from the red around the wheel and read as red
under the cube's lighting; the new one is further away while staying just as
vivid.

**In the code:** `CUBE3_COLORS` in `src/core/puzzles/cube3/geometry.ts`, and
`src/core/puzzles/colorblindPalette.ts`.

---

## 11. The Mirror Cube

A Mirror Cube turns exactly like a 3x3 — same moves, same group of 4.3 × 10¹⁹
positions — but every piece is one colour and a **different size**, so you
solve it by shape.

**Sizes.** Each axis is split into three slabs. The middle slab is 1.0 thick
and centred; the outer slabs differ: right 1.40, left 0.60, up 1.25, down 0.75,
front 1.15, back 0.85. A piece's box is the product of its three slabs, e.g. the
up-front-right corner is 1.40 × 1.25 × 1.15. Each axis totals 3.0, so the
solved puzzle is a 3 × 3 × 3 block, just off-centre.

**Why keep the middles centred?** Then every centre piece is a 1 × 1 square sitting
on its own axis, and turning it doesn't change its outline. So the solved
*shape* is exactly the 3x3's solved state with centre orientation ignored —
which is what the Kociemba solver solves. (A real Mirror Blocks offsets its
middles too, which makes the centres' rotation visible and needs extra
centre-twisting algorithms.) All six outer thicknesses are distinct and none is
1.0, so every corner and edge has a unique shape and visibly shows if it's
twisted.

**Tracking shapes.** Colours don't move on a 3x3 renderer — stickers are
repainted. Shapes have to physically travel, so each piece keeps a
**rotation matrix** `M` (3 × 3, entries −1/0/1). Its current slot is
`M · home`. A move rotates every piece in the turning layer by the same 90°
matrix `T`: `M ← T · M`. Drawing the piece's home-sized box rotated by `M` puts
the right shape in the right place, the right way round.

**Checking it against reality.** Run the same tracker on the coloured 3x3: a
piece's home sticker colour, rotated by `M`, must land exactly where cubing.js
says that colour is. 25 random 25-move sequences all match, so the shapes are
right too.

**In the code:** `src/core/puzzles/mirror/` (`pieces.ts`, `geometry.ts`,
`index.ts`), and the pose-based piece rendering in `PuzzleCanvas.tsx`.

---

### Further reading

- Herbert Kociemba's own explanation of the two-phase algorithm — kociemba.org
- *God's Number is 20* — cube20.org
- MediaPipe Hands landmark model — Google AI Edge documentation
- David Joyner, *Adventures in Group Theory* — the Rubik's Cube as a group, gently
