# A cube you can read: the CubePalm design language, and how it is built

The owner's brief, in their words: every part of the site should "exude the vibes of a cube, it being scrambled and solved"; the nav, the menu, the header and the footer included; motion "lifelike and breathable", "a bit more real, a bit more subtle", never at the cost of function; no AI-generated, template look; the Academy good enough that "a beginner who does not have too much expertise or ideas with cubes is able to follow through ... and solve the cube"; and the maths, the code and the solver made as strong as they can honestly be.

This document is the shared brief for several agents working at once. Read it all before you change anything.

## 1. The language

### P1. Everything moves in quarter turns, and lands with a click

A real cube's layer is flung, runs a hair past the quarter turn and is pulled back by the detent. That is the site's motion: rotations about an axis, in 90 degree steps where something turns, ending in a small, physical settle.

- Easings are springs with that detent, already defined: `ease-turn` (a layer: about 2% past), `ease-click` (a sticker or tile snapping in: about 4% past), `ease-soft` (a panel: no visible overshoot). They are Tailwind utilities (`ease-turn` and so on) and JS functions/CSS strings in `src/motion/easing.ts` (`turnEase`, `TURN_EASING`, ...). Use these, not ad hoc cubic-beziers.
- Durations: 160 to 240 ms for small UI responses, 260 to 420 ms for something turning over or arriving, never more than about 600 ms for anything the person waits on. Exits are faster than entrances.
- Prefer transforms and opacity. Never animate layout properties (width, height, top, left) on anything large.

### P2. Scrambled, then solved

State changes are told as a cube being scrambled and solved.

- Loading, thinking, or not done yet: stickers in mixed colours, shuffling.
- Ready, done, correct: stickers settling into one colour per face.
- Progress: a face solving one sticker at a time. The Academy has eight lessons, and a face has eight stickers round a centre that never moves; the centre is the learner's own first full solve.
- `src/components/cube/StickerGrid.tsx` does this already: give it new colours and each changed sticker turns over, the old colour tipping away and the new one clicking in, rippling out from a point (`from`). `gridStagger` in `src/motion/stagger.ts` gives the same ripple for anything else in a grid.

### P3. Six faces, six places

The cube's six colours are the site's six places. A page wears its face's colour as its accent: active nav item, the page's marks, focus accents where it helps.

| Place | Colour token |
|---|---|
| Learn (Academy) | `sticker-orange` |
| 3x3 | `sticker-green` |
| Mirror Cube | `sticker-blue` |
| Settings | `sticker-white` |
| How it works (`/how`, "Maths" in the nav) | `sticker-red` |
| Primary actions, Source | `sticker-yellow` |

Right hand yellow (`hand-right`), left hand cyan (`hand-left`) everywhere a hand is meant.

### P4. Black plastic and stickers

Surfaces are the cube's body; colour lives on stickers.

- Depth, from the floor up: `ink` (the page, the table), `panel` (a panel lying on it), `raised` (a control), `plastic` (the black between stickers; text printed on a sticker). The `plastic` utility gives a panel the faint highlight a lamp leaves on its top edge.
- Coloured, pressable things are stickers: flat colour, the `sticker` utility (a sheen along the top, a darker lip along the bottom), rounded corners in proportion to their size (about a fifth of the shorter side), never pills of one radius for everything.
- Gaps are the black lines between stickers: keep a consistent rhythm (4, 6 or 8 px between sibling stickers) so groups read as one face.
- Pressing a sticker pushes it in (a 1 to 2 px translate and the lip shrinking), and it clicks back out with `ease-click`.

### P5. Notation is type

A move is always drawn with `MoveChip` (`src/components/cube/MoveChip.tsx`): the layer letter and a curved arrow for its direction, in four states (`idle`, `next`, `current`, `done`). In words, use `src/core/notation.ts` (`moveWords`, `sequenceWords`, `splitMoves`). A learner should meet one consistent picture of "R'" everywhere.

### P6. Motion that means something, and one delight per screen

- Motion answers an action (opening, turning, confirming) or teaches (the hero cube, a lesson's demo cube). Ambient motion only where it teaches, paused off screen.
- One orchestrated moment per screen at most: the home page's first load, the solved celebration, the menu unfolding. Not fade-up-on-scroll for every section, not hover animations on every card.
- With `prefers-reduced-motion: reduce`, everything still works and still reads: stickers swap colour at once, cubes show the final state, page changes simply swap. Use `useReducedMotion()` / `prefersReducedMotion()` from `src/motion/stagger.ts`. The global CSS rule in `index.css` shortens CSS animations; it does not stop Web Animations API calls, so check for yourself.

### P7. Words

Plain, specific, sentence case, active verbs, British spelling as the site already uses ("colour"). Say what a button does ("Scramble", "Show me the next turn"), not "Get started". Errors say what happened and what to do. No filler, no exclamation marks, no emoji.

### Not this

These are the commonest tells of a generated page. Do not use them unless a section above calls for it:

- gradient-wash cards, glassmorphism blur panels as decoration, neon glows (the soft stage light behind a cube is the one exception: it is lighting, not decoration);
- tracked-out ALL-CAPS labels above headings, "A · B · C" meta strings, "WORD — fragment" labels, a "→" on every link;
- identical card grids with one radius and the same soft grey shadow;
- a monospace face for small labels; purple or indigo gradients; testimonials; numbered markers (01 / 02) on things that are not a sequence;
- one word of a headline in a different colour or italic.

Look at how real physical puzzles look and move (stickers, plastic, the click of a turn, a cube net, the way a face is drawn in a tutorial) before you look at other websites. Inspiration from libraries such as anime.js (grid staggers, springs, timelines) and React Bits is welcome as technique, rebuilt here with CSS and the Web Animations API: no new dependencies.

## 2. Shared pieces (already in the repo)

| What | Where | Notes |
|---|---|---|
| Colour, material and easing tokens | `src/index.css` `@theme`, `@utility plastic`, `@utility sticker` | `bg-ink`, `bg-panel`, `bg-raised`, `bg-plastic`, `text-fg`, `text-fg-muted`, `text-fg-faint`, `bg-sticker-*`, `text-hand-left`, `ease-turn`, `ease-click`, `ease-soft` |
| Spring easings | `src/motion/easing.ts` | `turnEase`, `clickEase`, `softEase`, `cssLinear`, `TURN_EASING`, `CLICK_EASING`, `SOFT_EASING` |
| Grid stagger, reduced motion | `src/motion/stagger.ts` | `gridStagger(index, { grid, from, each })`, `useReducedMotion()`, `prefersReducedMotion()` |
| A face of stickers that scrambles and solves | `src/components/cube/StickerGrid.tsx` | pass `colours` (memoise the array) |
| A move as a chip | `src/components/cube/MoveChip.tsx` | also `TurnGlyph` |
| Notation in words | `src/core/notation.ts` | |
| The small CSS-3D cube | `src/components/CssCube.tsx` | `setup` (start position), `stickerColour` (grey out pieces), `view` (how it is held), `pace`; handle: `turn`, `play`, `reset`, `highlight`. Cube space: x right, y up, z toward you. Owned by the lead: ask for changes, do not edit it. |
| Settings for feel | `src/state/settingsStore.ts` | `turnSound`, `haptics` (both default off) |
| Shell placeholders | `src/components/shell/SiteFooter.tsx`, `SiteMenu.tsx` | page screens place `<SiteFooter />` at their end; the play header places `<SiteMenu />`. The shell agent makes them real. |
| How it works route | `/how`, `src/components/screens/How.tsx` | placeholder |

## 3. Who owns what (wave 1)

Each file has one owner. Edit only files you own; create new files only under your own folders. If you need a change in someone else's file, say so in your final report with the exact change, and work around it meanwhile.

| Agent | Owns |
|---|---|
| Shell | `src/components/SiteNav.tsx`, `src/components/Logo.tsx`, `src/components/shell/*`, `src/App.tsx` (routes, transitions, loaders, not-found page), `src/index.css` (global rules; others use their own CSS files), `src/pageMeta.ts`, `index.html`, `public/sitemap.xml`, `src/components/ErrorBoundary.tsx` |
| Home | `src/components/screens/Home.tsx`, `src/components/SignPlayground.tsx`, `src/components/home/*`, `src/styles/home.css` |
| Academy | `src/components/screens/Academy.tsx`, `src/components/LessonPanel.tsx`, `src/core/academy/lessons.ts` (wording, and new lessons only with the lead), `src/components/academy/*`, `src/styles/academy.css` |
| Teacher (core) | `src/core/academy/teach/*` (new), `src/core/academy/stages.ts` |
| Play | `src/components/screens/FreePlay.tsx`, `src/components/screens/play/*`, `src/components/HandsGuide.tsx`, `src/components/SolutionPlayer.tsx`, `src/components/GestureConfidenceIndicator.tsx`, `src/styles/play.css` |
| 3D | `src/components/PuzzleCanvas.tsx`, `src/components/MoveArrow.tsx`, `src/core/feel/*` (new: turn sound and haptics) |
| Solver | `src/core/solvers/*`, `research/solver.study.ts`, `research/scrambles.study.ts`, `docs/MATH.md` |
| How it works | `src/components/screens/How.tsx`, `src/components/how/*`, `src/styles/how.css` |
| Pages | `src/components/screens/Settings.tsx`, `src/components/screens/Stats.tsx`, `src/components/screens/Recorder.tsx`, `src/styles/pages.css` |
| Lead | everything else, including `CssCube.tsx`, `src/motion/*`, `src/components/cube/*`, `src/core/notation.ts`, `src/state/*`, tests not named above, docs not named above |

A new CSS file of yours is imported by your own component (`import '../../styles/home.css'`); plain CSS, or Tailwind utilities in JSX.

## 4. Contracts between agents

- **PuzzleCanvas `focusSlots` (3D builds it, Academy and Play use it later).** A new optional prop `focusSlots?: [number, number, number][] | null`. When set, every cubie whose current slot is not in the list is dimmed the same way `previewLayer` dims (and the two combine: a cubie is dimmed if either dims it). Slots are `[x, y, z]` in `{-1, 0, 1}`, x right, y up, z front, the same as `src/core/academy/stages.ts`. A gentle transition in and out of focus is welcome.
- **PuzzleCanvas turn feel (3D).** Layer turns use `turnEase` from `src/motion/easing.ts`; the landing of each turn may play `src/core/feel` feedback when the settings ask for it. `turnMs` timing and `onAnimationComplete` semantics do not change (tests rely on them).
- **The teaching solver (Teacher builds it, Academy integrates it in wave 2).** In `src/core/academy/teach/`:
  - `teachSolve(state: PuzzleState): TeachStep[]` solves any cube3 state by the Academy's own layer-by-layer method, step by step, each step explained the way `lessons.ts` explains it.
  - `interface TeachStep { stage: StageGoal; lessonId: string; title: string; explain: string; moves: string[]; algorithm?: string; focus: { pieces: [number, number, number][]; target?: [number, number, number] } }`. `moves` are face turns in the app's fixed frame (no whole-cube rotations), so the guide's arrow can show each one. `focus.pieces` are the slots of the pieces the step is about, at the start of the step; `target` is where the piece is going.
  - `practicePosition(lessonId: string, below?: (n: number) => number): string` returns setup moves for a random position in which every stage before the lesson's is solved and the lesson's own stage is not (uniform over such positions), so a learner can practise on a real-looking cube, not only the fixed cases.
  - Colour names in text are those the learner sees: the Academy shows the cube with white on the bottom (FreePlay's `FLIP_COLORS` swaps white with yellow and green with blue on screen). Export whatever mapping you need.
  - Every claim is tested: for thousands of seeded random cubes, applying every step's moves solves the cube; each step's end state has its stage done; text never mentions a colour that is not on the pieces in focus.
- **SiteMenu and SiteFooter (Shell builds them).** `SiteMenu` is the menu button plus what it opens (usable in the play header and on phones); `SiteFooter` closes every content page. Keep both self-contained (no props required).
- **Page transitions (Shell).** Must not break deep links, the back button, scroll restoration, focus, the lazy route chunks, or any test.

## 5. Quality floor (every agent, every change)

- Touch targets at least 44 px on coarse pointers; text contrast at least 4.5:1; a visible focus ring; everything reachable and usable by keyboard; Escape closes what opened.
- No sideways scroll and no overlap at 320x640, 390x844, 768x1024, 1024x768, 1280x800, 1600x900 and a landscape phone 844x390.
- No console errors or warnings (apart from the known THREE.Clock deprecation and MediaPipe GL notes).
- Lighthouse: accessibility, best practices and SEO stay at 100. Performance must not drop: the home page loads no WebGL and no three.js; large new code is lazy.
- Every existing `data-testid` and every accessible name a test uses keeps working. Read `tests/e2e/*.spec.ts` before renaming anything. If an intended change of behaviour in your own area needs a test changed, change it minimally and say so in your report; never weaken a test to make it pass.

## 6. How to work

- The dev server runs at http://localhost:5173 for everyone. Do not start, stop or restart it, and do not run `npx kill-port`.
- Look at your work. Write throwaway Playwright specs named `tests/e2e/zz-<agent>-*.spec.ts` that save screenshots to `C:/Users/JAYMAN~1/AppData/Local/Temp/claude/c--Users-Jay-Manish-Guri-OneDrive-Desktop-Jay-Cube/e382c8a8-3465-4b37-a50c-c320560af13b/scratchpad/agents/<agent>/`, run one at a time with `npx playwright test zz-<agent> --retries=0`, read the images, iterate, and delete the specs when you finish. Do not run the whole suite (it takes ten minutes and others share the machine). Other agents are editing at the same time, so a failure in code you do not own may be theirs mid-edit: re-run once before you worry.
- Iterate: build, screenshot at several widths, critique against sections 1 and 5, fix, and repeat at least twice. Then remove one thing (Chanel's rule).
- Before you finish: `npx tsc -b` (no output), `npm run lint` (clean), `npx vitest run` (all pass), and the existing Playwright specs that touch your area must pass.
- No git commits, pushes or deploys. No new npm dependencies. No changes to `package.json`.
- A hook may block your first shell command and the first edit of each file until you state some facts (the request, who imports the file, any data schema, the owner's instruction). State them truthfully and retry.

## 7. After wave 1

The lead integrates: the teaching solver into the Academy (random practice positions; a step-by-step guided solve with the pieces in focus, which also becomes the ninth sticker, "your first full solve"), the menu into the play header, focus slots, feel settings in Settings; then a critique pass on every screen against this document, an accessibility and performance audit, cross-browser checks, fixes, and documentation of anything measured.
