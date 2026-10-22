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
table lookup is an admissible `h`. Building these tables is the warm-up the app
does in a background worker at start-up (1.5 to 4.1 seconds over five measured
runs in Node; see `docs/research/solver.md`).

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
   whose `h` exceeds what is left to spend can't lose a solution. There are
   five of these tables (three for phase 1, two for phase 2), built once in a
   web worker.
4. **Keep improving.** Both phases are searched by *cost*, not by number of
   moves: phase 1 at threshold 0, 1, 2, ... steps, and every phase-1 ending is
   handed to phase 2, bounded by the best total so far. Anything that isn't
   strictly cheaper is cut, so the answer only ever gets better until the time
   budget runs out. A third phase-1 table, corner twist x edge flip (4.5 million
   entries), tightens the estimate.
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
   permutation (40,320 states), the places of six edges (665,280 placements,
   stored in a table of 2,985,984 entries), and the places of the four slice
   edges. Each is exact for part of the cube, so the
   largest never over-estimates. IDA* tries cost 0, 1, 2, ... in order, so the
   first solution it finds is the cheapest that exists. Either it finds
   something cheaper than the two-phase answer, or it exhausts every cheaper
   cost, which **proves** that answer optimal. When all the estimates are 0 the
   cube must be solved: every corner and ten edges are placed, and the last two
   edges cannot be swapped alone without breaking the parity the corners fix.
   Measured on cubes `k` random face turns from solved, 20 for each `k`, with
   2 seconds allowed for the proof: every one was proven optimal up to `k = 8`
   (where they average 10.6 quarter turns from solved and took a median of
   2 ms), 17 of 20 at
   `k = 10`, 10 of 20 at `k = 12` and 4 of 20 at `k = 14`. None of 50 fully
   random cubes was proven in 5 seconds. So it is used where it works: lightly
   scrambled cubes and the end of every guided solve.

Cost is measured in **quarter turns** (`R2` counts as 2), because that is how
many sign, key or drag actions a person makes. Measured on 50 uniformly random cubes (one
thread, in Node): the very first answer averages 32.2 steps; after half a second
of search 26.1, after two seconds 25.0, after five seconds 24.7. In face turns,
the unit most of the literature uses, those same routes average 23.7, 20.7,
20.2 and 20.0. No position needs more than 26 quarter turns (the quarter-turn
"God's number").

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

The first route is asked for with a short budget (0.4 seconds of two-phase
search and up to 0.3 of proof, the `quick` setting in `kociemba.ts`), so Guide
me never makes you wait. A better one is then looked for in the background:

- **It starts early.** The search begins the moment a scramble lands, so by the
  time you press Guide me it has usually beaten the first route.
- **It is resumable.** The search keeps its own stack and runs in 30 ms slices,
  so it can be told to stop or to tighten its target within a blink.
- **It is spread over cores.** Up to three helper workers each take some of the
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
average stayed at 24.9 before and after (a figure from that experiment; its
code is gone, so unlike the measurements below it cannot be re-run), because two-phase answers are already
shortest over every stretch that short. Stretches long enough to matter are too
slow to prove. It was removed rather than kept as dead weight.

**A second thing that did not help.** The first phase searches with three
pruning tables built from small coordinates. A stronger one is the exact table
over the flip, the slice and the twist together (about 38.7 MB), which needs the
cube's symmetries to be reduced to fit. It was built and compared with the
shipped solver on 12 identical seeded random cubes, in one process: the first
route averaged 31.17 quarter turns against 29.50 and took 131 ms against 57; the
route after half a second averaged 25.83 against 25.50; and building the tables
took 4.4 s against 2.0 s. It also failed the project's own regression test on
mean route length. Larger tables cost more to build and to search through than
the tighter bound saved, so it was removed. These are single measurements on a
busy machine; the differences in route length and time were all in the same
direction.

### Random scrambles

A scramble is not a random string of moves, which would favour some cubes over
others. It is a **random state**: pick a corner arrangement and an edge
arrangement at random, make their parities agree, pick twists that sum to a
multiple of 3 and flips that sum to a multiple of 2, and you have one of the
43,252,003,274,489,856,000 reachable cubes with equal chance. The solver then
solves that cube, and the solution played backwards is the scramble. The random
numbers come from the browser's cryptographic generator, with the uneven tail
rejected so every value is equally likely.

### Why the answers can be trusted

The solver makes three promises: a route it returns solves the cube, a route it
calls "shortest" really is, and a scramble is a fair draw from every possible
cube. The first is checked by running every route through `cubing.js`. The
other two cannot be checked by testing, because the alternatives are too many
to try, so they are proved here. This part is stricter than the rest of the
document, but it uses nothing beyond sections 2 and 3.

**Setting.** A *state* is a reachable cube. A *move* is one of the 18 face
turns. A quarter turn costs 1 and a half turn costs 2; the cost of a sequence
is the sum, so costs are whole numbers. The inverse of a move is a move of the
same cost. Write `x·m` for the state reached from `x` by move `m`, `e` for the
solved cube, and `d(x)` for the cost of the cheapest sequence that solves `x`.
A *lower bound* is a function `h` with `h(x) ≤ d(x)` for every state `x`.

A *coordinate* is a rule `π` that reads a number off a state (its corner
twists, say) with one property: **the coordinate after a move depends only on
the coordinate before it and on the move.** So `π(x·m)` can be written
`π(x)·m`, and the moves act on the coordinate's values alone. Every coordinate
in the solver has this property, for the same reason each time: a move carries
the piece in one fixed slot to another fixed slot and changes its twist or
flip by a fixed amount.

| Coordinate | Reads | Why a move's effect needs nothing else |
|---|---|---|
| corner twist | the twist in each corner slot | the new twist in a slot is the old twist in the slot the piece came from, plus a fixed amount |
| edge flip | the flip in each edge slot | the same, for edges |
| slice position | which four slots hold middle-layer edges | slots are carried to slots |
| corner permutation | which corner is in each slot | slots are carried to slots |
| slots of a named set of edges | where each of those edges is | each is carried from its slot to another |
| two coordinates together | both numbers | each part moves by itself |

Two more coordinates (the order of the eight top and bottom edges, and the
order of the four middle-layer edges) are only used inside `G₁`, with `G₁`'s
ten moves. Those moves never carry an edge between the middle layer and the
other two, so there too the new value depends only on the old one.

**Claim 1 (a pruning table is the exact cost of a smaller puzzle, and a lower
bound for the real one).** Let `π` be a coordinate and let `T(y)` be the cost
of the cheapest move sequence that takes the coordinate value `y` to `π(e)`.
Then (a) `T(π(x)) ≤ d(x)` for every state `x`, and (b) the table the code
builds holds exactly `T`.

*Proof of (a).* Take a cheapest solution `m₁ … mₖ` of `x`, so
`x·m₁·…·mₖ = e`. Applying the coordinate property once per move,
`π(x)·m₁·…·mₖ = π(e)`. So the same sequence, at the same cost `d(x)`, takes
`π(x)` to `π(e)` in the smaller puzzle whose "states" are coordinate values.
The cheapest way to do that costs `T(π(x))`, which is therefore at most
`d(x)`. In words: forgetting part of the cube can remove obstacles but never
adds one, because every real solution is still a solution of what is left.

The same argument, word for word, covers the two variants the solver uses.
In phase 1 the target is "twist 0, flip 0, middle-layer edges in the middle
layer". Every state of `G₁` has those values, so the table is a lower bound on
the cost of reaching `G₁`, and (since `e` is in `G₁`) on `d(x)` too. In phase 2
the states are those of `G₁` and the moves are `G₁`'s ten, so the table is a
lower bound on the cost of finishing with those ten moves.

*Proof of (b).* `buildPrune` starts from the goal value at cost 0 and works
through cost levels 0, 1, 2, …. At level `L` it takes each value marked `L`
and marks each neighbour `L + 1` or `L + 2` (by the move's cost) unless the
neighbour already has a mark that small. Three facts make every mark exact.
First, a mark is always the cost of a real sequence, so it is never too small.
Second, marks written at level `L` are larger than `L`, so nothing marked `L`
or less changes again. Third, by induction on `L`, when level `L` begins every
value whose true cost is `L` is marked `L`: the value before it on a cheapest
route has true cost `L − 1` or `L − 2`, was correctly marked by the induction
hypothesis, and was processed at its own level, where it gave this value the
mark `L`. (This is Dijkstra's algorithm with the queue replaced by a sweep per
level, which whole-number costs allow. A plain breadth-first search would be
wrong here: a half turn can reach a value at cost `L + 2` before two quarter
turns reach it at `L + 1`, which is why marks may be lowered.) The search runs
outward from the goal, but each move can be undone by a move of the same cost,
so a route from the goal read backwards is a route to the goal at the same
cost. ∎

A detail: the six-edge table is indexed by two base-12 codes, so it has entries
for placements no cube can have (two edges in one slot). They are never
reached while building and never looked up while searching.

**Claim 2 (the largest of several lower bounds is a lower bound).** If
`h₁, …, hₙ` are lower bounds, so is `h(x) = max(h₁(x), …, hₙ(x))`.

*Proof.* For each state the maximum is one of the `hᵢ(x)`, and that one is at
most `d(x)`. ∎

Both searches use this: phase 1 takes the largest of three tables, phase 2 the
largest of two, and the whole-cube search the largest of six. Taking the
largest is the strongest safe way to combine them. Adding them would not be
safe, since one move can help two coordinates at once.

**Claim 3 (searching by cost level finds a cheapest solution first, and an
empty level is a proof).** Let `h` be a lower bound with `h(x) = 0` only for
`x = e`. For a whole number `T`, let `search(T)` walk depth-first through the
move sequences from `x`, giving up on a sequence as soon as *(cost so far) +
h(state reached)* exceeds `T`, and stopping when it reaches `e`. Then:

- (a) if some solution costs at most `T`, `search(T)` finds a solution costing at most `T`;
- (b) so if `search(T)` finds nothing, every solution costs at least `T + 1`;
- (c) if no solution costs less than `T₀`, then running `search(T₀)`, `search(T₀ + 1)`, … in order, the first solution found is a cheapest one, and its cost is the level at which it was found.

*Proof.* (a) Let `s` be a solution of cost `C ≤ T`, and take any point along
it: `g` spent so far, state `y` reached. The rest of `s` solves `y` for
`C − g`, so `d(y) ≤ C − g`, and since `h` never over-estimates,
`g + h(y) ≤ g + d(y) ≤ C ≤ T`. So the search never gives up anywhere along
`s`. A depth-first walk that is never turned away from `s` either reaches the
end of `s` or stops earlier because it has already found another solution; and
any solution it stops at passed the same test with `h = 0`, so it costs at
most `T`. (b) is (a) read backwards. (c) Suppose the first success is at level
`T`. If `T = T₀`, nothing is cheaper by assumption. Otherwise `search(T − 1)`
found nothing, so by (b) every solution costs at least `T`. The solution found
costs at most `T`, so it costs exactly `T`, and nothing is cheaper. ∎

*Why unequal costs do no harm.* The usual statement of this result counts
moves, and here a half turn counts double. Nothing above assumed equal costs.
The argument needs only that costs add up along a sequence (used in (a)) and
that they are whole numbers, so that no possible cost lies strictly between
level `T − 1` and level `T` (used in (c)). What would *not* work is searching
by number of moves: a two-move route `R2 U2` costs 4, more than the
three-move route `R U F`.

*Two shortcuts the code takes, and why they are safe.* The search does not try
every sequence: it never turns the same face twice running, and of two
opposite faces turned one after the other it tries only one order (the table
`ALLOWED`). Any sequence can be rewritten into that form without changing what
it does and without raising its cost: two turns of one face combine into one
turn or none (`R R = R2` costs the same, `R R2 = R'` and `R2 R2 =` nothing cost
less), and opposite faces can be swapped freely because they share no pieces.
Each combination shortens the sequence and the swaps between combinations are
a sort, so the rewriting ends. Hence a cheapest solution of the allowed form
always exists, and (a) holds with `s` chosen in that form. The second shortcut
is the test for "solved": the whole-cube search stops when all six of its
tables read 0. Then every corner is in place and untwisted, no edge is
flipped, and ten of the twelve edges are in place. The last two are either
right or swapped with each other, and a lone swap of two edges with the
corners in place would break the parity rule of section 2. So the cube is
solved, as the claim requires.

*What the code reports.* `proveOptimal` is exactly (c). If it finds a route,
that route is the cheapest there is. If it runs out of time during level `T`,
it reports "nothing costs less than `T`", which is (b) for the levels it did
finish. `solveDetailed` passes this on as `noneBelow`, and calls a route
proven only when `noneBelow` equals its cost.

**Claim 4 (the two-phase search, run to the end, is also a proof).** Let a
two-phase search (`RefineJob`) over one or more of the six views stop because
its cost level has reached `B`, the cost of the best route it knows of. Then
no route costs less than `B`. In particular, if `B` is the cost of the route
it found, that route is a cheapest one.

This needs an argument of its own, because phase 2 is not allowed all 18 moves
and so cannot, by itself, find every solution.

*Proof.* **Step 1: a view loses nothing.** A view is the same cube with the
faces renamed by a rotation of the whole cube, or the inverse cube, or both.
Renaming faces turns a solution into a solution with quarter turns still
quarter turns and half turns still half turns. Inverting replaces a solution
by its moves reversed and each inverted (section 3), again at the same cost. So
in every view the cheapest solution costs the same as for the real cube, and
it is enough to prove the claim for a single view.

**Step 2: every solution splits in two.** Take a cheapest solution `s` of the
allowed form, with cost `C`. Let *tail* be the longest run of `G₁` moves
(`U`, `D` by any amount; `R2`, `L2`, `F2`, `B2`) at the end of `s`, and *head*
the rest. Then head is empty or ends with a move that is not a `G₁` move. Let
`y` be the state after head. Tail solves `y`, so `y` is reached from solved by
tail played backwards, which is a sequence of `G₁` moves: `y` is in `G₁`. This
is the "last entry into `G₁`": every solution has one, even if it wanders in
and out of `G₁` before it.

**Step 3: phase 1 reaches the end of head.** At cost level `T`, phase 1 walks
the allowed sequences depth-first, gives up when *(cost so far) + (largest
phase-1 table)* exceeds `T`, and hands a sequence to phase 2 when its cost is
exactly `T`, all three tables read 0, and it is empty or does not end with a
`G₁` move. Take `T` = the cost of head. Part-way along head, with `g` spent,
the rest of head reaches `G₁` for `T − g`, so by Claims 1 and 2 the tables read
at most `T − g` and the search does not give up. It does not hand over early
either, because part-way along, the cost is still less than `T`. At the end of
head the cost is `T`, the tables read 0 because `y` is in `G₁`, and the last
move is not a `G₁` move. So head is handed to phase 2.

**Step 4: phase 2 then finds `s` or something as cheap.** Phase 2 searches
from `y` with `G₁`'s moves, in the allowed form following on from head's last
move, so tail is one of the sequences it may try. If no route is known yet, it
searches by cost level, and by Claim 3 (for the puzzle "finish from `y` with
`G₁` moves", with the phase-2 tables as lower bound by Claims 1 and 2) it
finds the cheapest allowed finish, which costs no more than tail. If a route
of cost `b` is known, it makes one pass, giving up when *(cost of head) +
(cost so far) + (largest phase-2 table)* is `b` or more, with `b` dropping
whenever it records something cheaper. Along tail that quantity never exceeds
`C`, so either the pass reaches the end of tail and records `s`, or it gave up
at a moment when `b ≤ C`. In every case, once head has been handled the best
known cost is at most `C`.

**Step 5: conclusion.** Suppose the search stopped at `B` although some route
costs less. Then the cheapest cost `C` is less than `B`, and with `s` as above
the cost `T` of head is at most `C`, so `T < B`. The best known cost only ever
goes down, so it was never below `B`, and the search stops only when its level
reaches the best known cost. So level `T` was searched in full, and by Steps 3
and 4 the best known cost was then at most `C < B`: a contradiction. ∎

Three remarks on how this matches the code.

- *Pausing.* The search keeps its place on its own stack, so being run in
  slices changes when it does things, not what it does.
- *Sharing between workers.* A worker told by another that a route of cost
  `b` exists just lowers its target (`tighten`). The proof never asked where
  `B` came from, so a worker that owns only two of the six views, and
  finishes, has still proved that nothing is cheaper than its target. That is
  why one worker finishing is enough.
- *The safety stop.* The search also stops if its level passes 40. If it ever
  stopped for that reason alone, the proof above would not apply. It cannot:
  Step 5 shows the search stops by level `C` at the latest once it holds a
  real route, and no cube needs more than 26 quarter turns (Rokicki and
  Davidson, 2014). This is the one place the argument leans on a result from
  outside this document. Likewise, phase 2's first search ends only because
  every state with twist 0, flip 0 and the middle-layer edges in the middle
  layer can be finished with `G₁` moves, which is the standard description of
  `G₁` (Kociemba). If that failed, the search would hang, not give a wrong
  answer.

**Claim 5 (a scramble is a uniform draw from the reachable cubes).** Given a
source of uniform random whole numbers, `randomCubie` returns each of the
`N = 43,252,003,274,489,856,000` reachable states with probability exactly
`1 / N`.

*Proof.* The state is built from four independent parts.

*Corners in order.* `randomPermutation(8)` is the Fisher-Yates shuffle: for
`i = 7, 6, …, 1` it swaps position `i` with a uniformly chosen position
`j ≤ i`. There are `8 · 7 · … · 2 = 8!` equally likely lists of choices. Two
different lists give different arrangements: at the first step where they
differ they leave different pieces in position `i`, which is never touched
again. So the `8!` lists give `8!` different arrangements, which is all of
them, each with probability `1 / 8!`.

*Edges in order.* In the same way the twelve edges start as a uniform
arrangement, each with probability `1 / 12!`. Then, if its parity differs from
the corners', the edges in slots 10 and 11 are swapped. Call that swap `τ`. It
is one swap, so it changes parity, and doing it twice changes nothing: it
pairs each odd arrangement with exactly one even one. Fix a corner arrangement
`c` and an edge arrangement `p` of the same parity. The generator returns
`(c, p)` in exactly two ways: it drew `c` and `p` and left them alone, or it
drew `c` and `p` with slots 10 and 11 swapped (opposite parity, so the fix
applied and produced `p`). So `(c, p)` has probability `(1/8!) · (2/12!)`, the
same for every matching pair, and pairs that do not match are never returned.

*Twists.* Seven twists are drawn uniformly from `{0, 1, 2}` and the eighth is
set to make the total a multiple of 3. Sending the seven to all eight is
one-to-one, and it reaches every list of eight twists with total a multiple of
3 (given such a list, its first seven entries produce it). So each of those
`3⁷` lists has probability `1 / 3⁷`.

*Flips.* Likewise eleven flips are drawn and the twelfth makes the total even:
each of the `2¹¹` allowed lists has probability `1 / 2¹¹`.

The four parts are independent, so every state that obeys the three rules of
section 2 has probability

```
  1     2     1     1
 --- · --- · --- · ---  =  1 / N,      N = 8! · (12!/2) · 3⁷ · 2¹¹
  8!   12!   3⁷    2¹¹
```

and no other state is ever produced. Section 2 showed that every reachable
cube obeys the three rules. The converse, that every arrangement obeying them
is reachable, is the classical structure theorem for the cube group (proved,
for example, in Joyner's book listed below). So the states that obey the rules
are exactly the reachable ones, and the generator is uniform over them.
`docs/research/scrambles.md` multiplies `N` out in exact arithmetic. ∎

One qualification, for honesty. `randomScramble` throws away the solved cube
and any cube the solver finishes in fewer than 16 face turns, so that nobody is
handed an easy scramble. The cubes it hands out are therefore uniform apart
from that filter, and since the filter depends on what the solver finds in a
quarter of a second, a cube right at the limit may be kept on one machine and
redrawn on another.

**Claim 6 (rejecting the uneven tail removes modulo bias).** Let `n` be a
whole number from 1 to `2³²`. Given uniform 32-bit numbers, `randomBelow(n)`
returns each of `0, 1, …, n − 1` with probability exactly `1 / n`, and takes
fewer than two draws on average.

*Proof.* Let `q` be `2³² / n` rounded down and `limit = q · n`, the largest
multiple of `n` not above `2³²`. The function draws a uniform `u` from `0` to
`2³² − 1`, starts again if `u ≥ limit`, and otherwise returns the remainder of
`u` on division by `n`. A draw is kept with probability `limit / 2³²`
whatever happened before, and given that it is kept, `u` is uniform over
`0 … limit − 1`. Those `q · n` numbers split into `q` complete runs
`0 … n − 1`, `n … 2n − 1`, …, so each remainder occurs for exactly `q` of
them, and has probability `q / (q · n) = 1 / n`. For the number of draws:
`q ≥ 1`, and rounding a number that is at least 1 down loses less than half
of it, so `limit > 2³¹` and each draw is kept with probability above one half.
The number of draws is then geometric with mean `2³² / limit < 2`, and the
loop ends with probability 1. ∎

Without the rejection, the remainders `0 … (2³² mod n) − 1` would each occur
for `q + 1` values of `u` and the rest for `q`: a bias of about `n / 2³²`,
tiny for the `n ≤ 12` used here, but the claim of *exact* uniformity in Claim
5 depends on its absence. The proof assumes the 32-bit numbers themselves are
uniform, which is what the browser's `crypto.getRandomValues` is specified to
provide; that is an assumption about the browser, not something this project
can prove.

**What was measured, as opposed to proved.** The solver's figures in this
section (build times, route costs, how often a route is proven) come from two
experiments that anyone can re-run with `npm run research`. Timings and costs
after a time budget depend on the machine, so a re-run will differ a little
from the figures quoted above; the reports name the machine and the seed:
[`docs/research/solver.md`](research/solver.md) (table build times, route
costs at several time budgets, how often a route is proven shortest, and a
check of every route against `cubing.js`) and
[`docs/research/scrambles.md`](research/scrambles.md) (chi-square tests of the
scramble generator, including the computed last twist and flip and the two
slots the parity fix swaps). The uniformity tests also run, with a fixed seed,
in `src/core/solvers/twoPhase.test.ts`.

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
