# CubePalm: a browser Rubik's Cube controlled by hand signs

A short technical report. Every number in sections 3 and 4 is produced by a script in this repository (`npm run research`) and written to [`docs/research/`](research/); none is an estimate. Where a result comes from a model and not from people, it says so. The few figures in section 5 were measured by hand in a browser and are marked as such.

## 1. What the project is

CubePalm is a Rubik's Cube and a Mirror Cube that run in a web browser, with no server. A webcam watches the player's hands; holding up a pattern of fingers turns a layer. The same cube can be turned by mouse, keyboard or on-screen buttons. A solver written for the project gives the next move on request and keeps looking for a shorter route while the player follows it.

Three parts are worth a technical reader's time:

- **Reading hand signs** from the 21 landmarks per hand that MediaPipe reports (section 3).
- **Solving the cube** with a two-phase search and a second search that can prove a route is the shortest (section 4).
- **Keeping it responsive**: hand tracking, solving and drawing each run where they cannot block one another (section 5, and [ARCHITECTURE.md](ARCHITECTURE.md)).

## 2. How results are produced

`research/` holds experiments that import the app's real code, never copies of it: the sign recogniser the app runs is the one measured, and the solver the app ships is the one benchmarked. Each experiment has a fixed seed and writes a Markdown report that states its own parameters. Two rules were set before any result existed and are recorded in the [plan](plans/2026-10-11-research-impact.md): no number enters a document unless a script produced it, and a change to how signs are read does not become the default on evidence from a model alone.

## 3. Reading a hand sign

A sign is four fingers, each up or down. Nine of the sixteen patterns are signs; the other seven, and any relaxed hand, must be read as nothing, or the cube turns when nobody asked.

### 3.1 Method

With a camera nobody knows the true pose, so accuracy cannot be measured directly. The study uses a posable hand model ([`handModel.ts`](../src/core/gestures/handModel.ts)) that produces the same 21 landmarks from a known pose, with controllable turn, tilt, size, finger length and jitter. Six ways of reading a pose are scored on the same generated hands. The ones with something to fit are fitted on one random draw (4,000 hands) and scored on a different one (8,000 hands).

This measures how sensitive each reader is to each thing that varies. It does not measure accuracy on people: the model's proportions were chosen by eye, its joints bend in one plane, and its jitter is independent from landmark to landmark, which real tracking error is not.

### 3.2 Findings

Full tables: [sign-recognition.md](research/sign-recognition.md), [temporal-filtering.md](research/temporal-filtering.md).

**A units error in the geometry.** MediaPipe reports x as a fraction of the picture's width and y as a fraction of its height. On a 4:3 picture, distances measured across the hand are therefore on a different scale from distances along it, and a hand turned in the picture is measured stretched. The rule the app shipped with read 75.4% of signs in the realistic setting. Converting to square pixels first, and changing nothing else, raised that to 89.9%. With the hand turned 30 degrees the original rule read 72.8% and the corrected one 100.0%.

**One threshold for four fingers.** The shipped rule calls a finger raised when its tip is more than 1.4 hand-lengths from the wrist. The little finger is the shortest, so it has the least margin: in the model it was misread on 21.81% of hands, against under 0.1% for each other finger. With fingers 20% shorter than the model's, the rule read 44.4% of signs.

**Reading signs well is half of it.** Readers that judge each finger by its own shape (how straight it is, and whether it points the way the palm does) read 99.0% to 100.0% of signs. But the same readers called a relaxed, half-open hand a sign on 39.1% to 56.9% of frames, against 20.9% for the shipped rule. A reader that reads every sign and also turns the cube whenever the player rests is worse to use, not better. This was not anticipated; it appeared when the timing study measured turns per minute from an idle hand.

**A dead zone resolves it.** A finger is raised only when clearly straight, folded only when clearly bent, and otherwise neither, in which case the hand makes no pose. This reader called a relaxed hand a sign on 0.5% of frames and read 94.1% of signs. Its cost is sensitivity to jitter: at jitter of 4% of hand size it turned 46.7% of held signs correctly, and 94.7% once the landmarks were smoothed with a One-Euro filter.

**A lost frame was treated as letting go.** When the tracker dropped the hand on one frame in five, 68.6% of held signs produced the one correct turn, because a frame with no hand counted as a vote against the sign and restarted the hold. Waiting up to 240 ms for the hand to return raised that to 97.5%.

**The hold time is a trade.** With the shipped vote (4 of the last 6 frames) and hold (550 ms), a turn comes a median of 660 ms after the pose is formed. Shortening the hold to 250 ms brings that to 380 ms and raises turns per minute from an idle hand from 0.75 to 3.45 with the shipped rule.

### 3.3 What changed in the app

- The grace period for a lost hand is on for everyone. It is a change to the logic over time, not to how a frame is read, and it does not depend on the hand model being right.
- Square pixels, the dead-zone reader and smoothing are offered together as **Settings > Sign reading > Precise**. The original rule stays the default, because it was tuned with a real camera and the alternative has so far been measured only on a model.
- A recorder at `/record` saves the landmarks of real hands making prompted signs (coordinates only, never pictures). The study scores every reader on any recordings placed in `research/recordings/`. That is the experiment that would settle the default, and it has not been run: see section 6.

## 4. Solving the cube

The algorithm and its proofs are in [MATH.md](MATH.md). Measurements: [solver.md](research/solver.md), [scrambles.md](research/scrambles.md).

**Route length.** Over 50 uniformly random cubes, in one thread: the first route found averaged 32.22 quarter turns and arrived after a mean of 29.2 ms. Continuing the search brought the mean to 26.1 after 0.5 s, 25.02 after 2 s and 24.7 after 5 s (20.04 face turns). A half turn counts as two quarter turns throughout, because that is how many actions the player makes.

**Proof of optimality.** A second search can prove that no shorter route exists. It did so for every one of 20 positions at each depth from 2 to 8 random face turns from solved, for 95% at 9, 50% at 12 and 20% at 14. It proved none of the 50 random cubes within 5 seconds. The app therefore says "shortest possible" only when it holds a proof, which in practice is near the end of a solve, and otherwise shows the best route it has found.

**Correctness.** All 460 routes produced in the benchmark were replayed in cubing.js, an independent implementation, and solved their cubes.

**Fair scrambles.** A scramble is a uniformly random reachable cube, solved and played backwards. Over 600,000 generated states, none broke a reachability rule, and nine chi-square tests (including the values that are computed, not drawn, where a bias would hide) were all below the 99.9% critical value.

**Two results that were negative.** Replacing each stretch of a route by its provably shortest equivalent sounded promising and gained nothing: routes were already shortest over every stretch short enough to prove. An extra pruning rule in the first phase also measured no gain. Both were removed, and both are recorded in MATH.md.

## 5. System design

[ARCHITECTURE.md](ARCHITECTURE.md) describes the threads, their message protocols, the failure paths and the storage. In brief:

- Hand tracking runs in a worker. On the main thread it blocked drawing for about 25 ms per camera frame on a fast desktop (measured by hand in a browser, not by a script).
- Camera frames are a feed that components subscribe to, not React state, so a frame does not re-render the screen. With the processor slowed six times in the browser's developer tools, the play screen in Hands mode went from about 10 to 77 frames a second across these two changes (again a manual measurement, on a development build).
- The cube is drawn only when something changes: no draws while it sits still.
- The solver has one owner for its worker's life. A worker that fails to load, crashes or goes silent is abandoned and the main thread answers, so no request can hang.
- Every turn passes through one queue. A scramble is the start of an attempt: Undo stops there and Reset returns there.

## 6. Limits, and what would come next

- **No measurement on people yet.** Section 3's numbers describe the readers on a model. The recorder and the scoring code exist; the recordings do not. [STUDY.md](STUDY.md) is the protocol for collecting them, and for comparing the four input methods using the on-device log shown at `/stats`.
- **The hand model is simple.** It would be worth replacing its hand-chosen proportions with measured ones once recordings exist, and checking whether the model then predicts the readers' behaviour on real hands.
- **Optimality is out of reach for a random cube in a browser.** Routes average about 24.7 quarter turns after five seconds; the proof search finishes only close to solved.
- **The benchmark is one machine, one thread, in Node.** The browser runs the same code but spreads the search over several workers.
- **MediaPipe is taken as given.** Nothing here improves the landmark model itself; everything is in what is done with its output.

## 7. Reproducing

```bash
npm install
npm test            # unit tests
npx playwright test # browser tests against the real app
npm run research    # regenerates every report in docs/research/ (about nine minutes)
```
