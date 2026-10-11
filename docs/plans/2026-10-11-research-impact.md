# Research Impact Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use godmode:task-runner to implement this plan task-by-task.

**Goal:** Turn CubePalm from "an app that works" into "an app with measured claims", so it reads as research-shaped work on a CS Master's application, without replacing MediaPipe.

**Architecture:** Everything is measured by code that lives in the repo and can be re-run with one command. A `research/` folder holds experiments that import the app's real recognisers and solver (no copies), run them on generated or recorded data, and write Markdown tables into `docs/research/`. The app gains a recorder so real hand data can flow into the same experiments later, and a local usage log so input methods can be compared.

**Tech Stack:** TypeScript, Vitest (as the experiment runner, via a second config), the existing sign recogniser and two-phase solver, MediaPipe hand landmarks (unchanged). No Python, no new runtime dependencies.

**Working agreement for this plan:** work happens on `main` with a push after each workstream (the owner's standing instruction), not in a worktree. Commit messages carry no co-author line (owner's standing instruction). Every number written into a doc must come from a script in the repo; no estimated figures.

---

## What "done" looks like

| Area | Today | After this plan |
|---|---|---|
| CV | Finger rule with one fixed threshold; accuracy never measured | A hand model that generates test data; accuracy measured against tilt, distance, noise and hand shape; a second recogniser (joint angles) and a small learned one, compared on the same data; the better one shipped |
| HCI | Four input methods, never compared | A local usage log (time per turn, mistakes, undos per method), an on-device summary screen, an export, and a short study protocol |
| System design | Described in README prose | `docs/ARCHITECTURE.md`: threads, message flow, failure paths, performance budget, with diagrams |
| Mathematics | Solver explained; numbers quoted from ad-hoc runs | A reproducible solver benchmark; a statistical test that scrambles are uniform; proofs of the bounds' admissibility and of the search's completeness written out |
| Write-up | README | `docs/REPORT.md`: a short paper-style report that cites the generated tables |

Out of scope: replacing MediaPipe; training image models; collecting data from other people (Workstream F prepares for it and is last).

---

## Workstream A: Measuring and improving sign recognition (CV)

### Task A1: A parametric hand

**Files:**
- Create: `src/core/gestures/handModel.ts`
- Test: `src/core/gestures/handModel.test.ts`

A kinematic hand: 21 landmarks built from bone lengths and per-finger curl (0 = straight, 1 = fully curled), then scaled, rotated (roll, pitch, yaw) and placed in the image, with optional Gaussian noise from a seeded generator. Bone-length ratios follow standard hand anthropometry and can be varied (short fingers, long fingers).

Tests: a straight finger's tip is farther from the wrist than a curled one; rotating by 0 changes nothing; the same seed gives the same hand; every sign in `POSE_FOR` can be generated.

Verify: `npx vitest run src/core/gestures/handModel.test.ts` passes.

### Task A2: Two more ways to read a pose

**Files:**
- Create: `src/core/gestures/poseReaders.ts`
- Test: `src/core/gestures/poseReaders.test.ts`
- Modify: `src/core/gestures/signGestures.ts` (take the reader as an option; default unchanged until A4 decides)

1. `distanceReader`: the current rule, moved here unchanged (tip-to-wrist distance over hand size against one threshold).
2. `angleReader`: a finger is extended when the angle at its middle joint is nearly straight. Depends on neither hand size nor which way the hand faces.
3. `learnedReader`: logistic regression over joint angles and normalised tip distances, one output per finger. Trained by plain gradient descent in TypeScript; weights saved as a JSON module.

Tests: all three read the nine poses correctly on a clean, front-facing hand; `distanceReader` output equals the old `fingerPose` on the same input.

### Task A3: The experiment runner

**Files:**
- Create: `vitest.research.config.ts`, `research/report.ts` (Markdown table writer)
- Modify: `package.json` (script `research`), `vitest.config.ts` (exclude `research/`)

`npm run research` runs every `research/*.study.ts` and writes `docs/research/*.md`. Each report starts with the command and seed that produced it.

### Task A4: The recognition study

**Files:**
- Create: `research/sign-recognition.study.ts`, `research/trainReader.ts`
- Output: `docs/research/sign-recognition.md`, `src/core/gestures/learnedWeights.json`

For each reader: accuracy over the nine poses as each one of these varies while the rest stay nominal: hand roll, pitch toward the camera, yaw, landmark noise, finger-length ratio, partial curl (a half-raised finger). Plus a confusion matrix at a realistic mixed setting, and false-positive rate on non-sign hands (open hand, fist, relaxed). The learned reader is trained on one random draw and tested on a different one.

Decision rule, written into the report before the numbers are read: ship the reader with the highest accuracy at the mixed setting, unless it is within one percentage point of the current rule, in which case keep the current rule.

Amended before the study was first run: a reader that wins only on model hands does not replace the default, which the owner has tested by hand. It ships as an option in Settings. It becomes the default only when recordings of real hands (Task B3) confirm the result.

### Task A5: Smoothing in time

**Files:**
- Create: `src/core/gestures/oneEuro.ts` + test, `research/temporal.study.ts`
- Output: `docs/research/temporal-filtering.md`

Compare majority vote (current), a One-Euro filter on the landmarks, and both together, on generated sequences with jitter and dropped frames: false turns per minute while holding still, and delay from making a sign to it registering.

### Task A6: Ship the winner

**Files:**
- Modify: `src/core/gestures/signGestures.ts`, its tests, `tests/e2e/hand-signs.spec.ts` if the synthetic frames need joints

Apply the A4 and A5 decisions. Full unit and browser suites must pass.

---

## Workstream B: Comparing input methods (HCI)

### Task B1: A usage log

**Files:**
- Create: `src/state/usageLog.ts` + test
- Modify: `src/components/screens/FreePlay.tsx` (record each turn's method and time, off-track turns, undos, solves)

Stored locally (`cubepalm.usage.v1`), capped in size, validated on load, never sent anywhere.

### Task B2: A summary screen and export

**Files:**
- Create: `src/components/screens/Stats.tsx`
- Modify: `src/App.tsx` (route `/stats`), `src/components/screens/Settings.tsx` (link), `src/pageMeta.ts`

Per method: turns, median time per turn, mistakes per 100 turns, solves and times. A button downloads the log as JSON; another clears it.

### Task B3: A hand-data recorder

**Files:**
- Create: `src/components/screens/Recorder.tsx`, `src/core/gestures/recording.ts` + test
- Modify: `src/App.tsx` (route `/record`)

Prompts each sign in turn, records landmark frames with the prompted label and the conditions the person ticks (lighting, distance, glasses), and downloads a JSON file. `research/sign-recognition.study.ts` reads any files placed in `research/recordings/` and reports them next to the generated data.

---

## Workstream C: System design

### Task C1: `docs/ARCHITECTURE.md`

Threads and workers, the message protocols between them, the frame path from camera to cube, the move queue and its start-of-attempt rule, failure paths and fallbacks, and the performance budget, with Mermaid diagrams. Every claim cites the file it describes.

---

## Workstream D: Mathematics

### Task D1: A reproducible solver benchmark

**Files:**
- Create: `research/solver.study.ts`
- Output: `docs/research/solver.md`

Fixed seed, N random states: route length distribution at several time budgets, how often a route is proven shortest and at what length, table-build time.

### Task D2: Is a scramble really uniform?

**Files:**
- Create: `research/scrambles.study.ts`; a permanent test in `src/core/solvers/twoPhase.test.ts`
- Modify: `src/core/solvers/twoPhase.ts` (let `randomCubie` take a random source, so the test is repeatable)

Chi-square tests on corner positions, edge positions, twist and flip over many generated states, and a check that every state is reachable (parities).

### Task D3: Proofs in `docs/MATH.md`

Admissibility of each lower bound, why the maximum of admissible bounds is admissible, completeness of the cost-level search, and the uniformity argument for the scramble generator, each stated as a claim with a proof.

---

## Workstream E: The report

### Task E1: `docs/REPORT.md` and README

A paper-shaped summary (problem, system, method, results, limitations, what would come next) that cites the generated tables, and a README top section that leads with the measured results.

---

## Workstream F (last): Help from friends

### Task F1: `docs/STUDY.md`

Two tasks a friend can do in ten minutes without help: (1) open `/record`, follow the prompts, send the file; (2) solve two guided scrambles with each input method, then export from `/stats` and send the file. Includes the consent wording and what is and is not recorded.

---

## Order and parallelism

- Independent, started together: A1 to A3, C1, D1 to D3.
- A4 and A5 need A1 to A3. A6 needs A4 and A5.
- B1 to B3 are independent of A, apart from B3 feeding A4's optional recorded data.
- E1 needs the generated tables. F1 needs B2 and B3.

After each workstream: `npx tsc -b`, `npm run lint`, `npx vitest run`, `npx playwright test`, then commit and push.
