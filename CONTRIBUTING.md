# Helping with CubePalm

CubePalm is a passion project. I started it because I have solved cubes for years and wanted to see if a webcam could turn finger signs into moves. It is not trying to change anything for anyone. It is something I enjoy working on, and I would like to work on it with people who enjoy the same kind of problem.

If you want to read the code to see how it works, that is a perfectly good reason to be here. If you want to fork it and build your own version, please do. The licence is MIT, so you don't need to ask. If you would like to help make this one better, this page is how.

## Where help would matter most

These are the places where I know the project is weakest, roughly in order of how much they would change things.

**The hand reader on real hands.** Sign reading was measured on a posable hand model, not on people. The model is simple, and its numbers say more about how the readers behave than about how accurate they are in your living room. The most useful thing anyone can do is record their hands and send the file: [`docs/STUDY.md`](docs/STUDY.md) explains how, it takes about ten minutes, and it saves landmark coordinates only, never pictures. If you would rather write code, the readers live in `src/core/gestures/` and the study that scores them is `research/sign-recognition.study.ts`.

**The solver.** It finds a first route in about 29 ms and averages 24.7 quarter turns after five seconds. Shorter routes, faster routes and stronger proofs of optimality are all open. The search is in `src/core/solvers/twoPhase.ts`, and the reasoning behind it is in [`docs/MATH.md`](docs/MATH.md). I tried one idea that did not pay off (it is written up near the end of section 8), so read that before you repeat it.

**More puzzles.** The 3×3 and the Mirror Cube are in `src/core/puzzles/`. A 2×2, a Skewb or a Pyraminx would each teach the puzzle interface something.

**The Academy.** The lessons are in `src/core/academy/lessons.ts` and the beginner solver behind the guided mode is in `src/core/academy/teach/`. Better explanations, other languages, and cases a beginner gets stuck on that the text does not cover are all welcome.

**Accessibility, phones and other browsers.** The browser tests run in Chromium, so that is where I have looked hardest. Safari and Firefox need more eyes, and so do small screens and screen readers.

**Tests and docs.** If something confused you while reading, that is a bug in the docs. Fix it or tell me.

## Running it

You need Node 20 or newer.

```
git clone https://github.com/JayGuri/cubepalm.git
cd cubepalm
npm install
npm run dev
```

Open http://localhost:5173. The first install copies the MediaPipe runtime out of `node_modules` into `public/mediapipe/wasm/`; that folder is generated and is not committed. If that copy fails on Windows with a permissions error, close any other dev server that is running and try again.

Hands mode needs a webcam, and a browser only gives out the camera on `localhost` or HTTPS.

## Checking your change

```
npx tsc -b            # types
npm run lint          # lint
npm test              # unit tests
npx playwright test   # browser tests, about ten minutes
npm run research      # regenerates docs/research/*.md, about nine minutes
```

You rarely need all of them. Run the ones near what you changed: a solver change needs `npm test` and the guided-solve browser tests; a change to a screen needs the browser tests for that screen. The browser tests draw the 3D cube in software, so they are slow. That is normal.

## How I would like changes to look

Small and focused is easiest for me to read and easiest to get right. One idea per pull request. If you are about to change something large, open an issue first so we can talk it through before you spend a weekend on it.

Anything the project says about itself should be true and checkable. If you add a number to the docs or the website, it should come from a script in `research/` or from a test, not from a feeling. Measurements on a model are model measurements and should say so.

Please don't add a dependency for something a few lines can do. The bundle is kept small on purpose, and the home page loads no 3D code at all.

The commit messages in this repo say what changed and why, in plain sentences. Please do the same.

## Privacy

The recorder saves the positions of 21 points on each hand, never images or video. Nothing is sent anywhere; the person recording gets a file and chooses what to do with it. Any change that touches the camera, the recorder or the usage log needs to keep that true.

## Being kind

Be decent to each other. Assume the person on the other side of an issue is trying their best, because they usually are. If someone is new to cubing, to computer vision or to open source, remember when you were too.

If anything here is unclear, open an issue and ask. Thank you for reading this far.

Jay
