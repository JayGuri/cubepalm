import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { LESSONS } from '../../core/academy/lessons'
import { useAcademyStore } from '../../state/academyStore'
import { StickerGrid } from '../cube/StickerGrid'
import { HeroStage } from '../home/HeroStage'
import { SiteFooter } from '../shell/SiteFooter'
import { SignPlayground } from '../SignPlayground'
import { SiteNav } from '../SiteNav'
import '../../styles/home.css'

const GITHUB = 'https://github.com/JayGuri/cubepalm'

// The six sticker colours (index.css), for the faces drawn on the puzzle tiles.
const C = { w: '#f4f5f8', y: '#ffd500', r: '#f0566b', o: '#ff8a00', g: '#2fb36b', b: '#5b8def' }
// A scrambled face with its green centre: the 3x3, waiting to be solved.
const SCRAMBLED = [C.r, C.w, C.g, C.y, C.g, C.b, C.g, C.r, C.o]
// The Academy's face: an orange centre, and one sticker round it for each
// lesson, orange once that lesson is done and scrambled until then. Ring
// order runs clockwise from the top left.
const RING = [0, 1, 2, 5, 8, 7, 6, 3]
const UNSOLVED = [C.w, C.g, C.r, C.y, C.b, C.r, C.w, C.g]

function AcademyFace({ done }: { done: string[] }) {
  const colours = useMemo(() => {
    const face = Array<string>(9).fill(C.o)
    LESSONS.forEach((lesson, i) => {
      if (!done.includes(lesson.id)) face[RING[i]] = UNSOLVED[i]
    })
    return face
  }, [done])
  return <StickerGrid colours={colours} sticker={30} gap={4} from={RING[Math.max(0, done.length - 1)]} />
}

const H2 = 'font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl'
const LINK = 'inline-flex min-h-11 items-center font-semibold underline decoration-current/40 underline-offset-4 hover:decoration-current'

// Every number here is quoted from docs/REPORT.md and docs/research/, which
// scripts in research/ produce. Model hands are model hands.
const FACTS = [
  {
    title: 'Hand tracking in a worker',
    body: 'MediaPipe finds 21 points on each hand, in a background thread, so the model never holds up drawing. On the main thread it had blocked drawing for about 25 ms a camera frame on a fast desktop (measured by hand).',
  },
  {
    title: 'Signs, measured',
    body: 'Sign reading was tested on a posable hand model whose true pose is known. That found a units error in the geometry: correcting it raised the signs read on the model from 75.4% to 89.9%. A stricter reader cuts a relaxed hand being read as a sign from 20.9% to 0.5%. Not yet measured on people.',
  },
  {
    title: 'A solver of its own',
    body: 'A two-phase search written for CubePalm. Over 50 random cubes its first route averaged 32.2 quarter turns, found in about 29 ms, and it keeps looking while you play: 24.7 after five seconds. All 460 routes from the benchmark were replayed in cubing.js, a separate cube engine, and every one solved its cube.',
  },
  {
    title: 'Proof of the shortest route',
    body: 'A second search can prove that no shorter route exists. It did for all 20 test positions at each depth from 2 to 8 random face turns, for 50% at 12 and 20% at 14, and for none of 50 random cubes within 5 seconds. So the guide says “shortest possible” only when it holds the proof.',
    chart: true,
  },
  {
    title: 'A cube you solve by shape',
    body: 'On the Mirror Cube every block keeps its own position and rotation, so the shape of the cube is the puzzle: it is solved when the blocks make a clean cube again.',
  },
]

// docs/research/solver.md, "How often a route is proven shortest": 20 positions
// made by k random face turns from solved, for each k from 2 to 14.
const PROVEN = [20, 20, 20, 20, 20, 20, 20, 19, 17, 13, 10, 8, 4]
const CELL = 12
const LABEL = 30

function ProofChart() {
  const width = LABEL + 20 * CELL
  return (
    <figure className="mt-5">
      <svg
        width={width}
        height={PROVEN.length * CELL}
        viewBox={`0 0 ${width} ${PROVEN.length * CELL}`}
        role="img"
        aria-label={`Routes proven shortest, of 20 positions each: ${PROVEN.map((n, i) => `${n} at ${i + 2} turns`).join(', ')}.`}
        className="max-w-full"
      >
        <defs>
          <pattern id="proven-yes" x={LABEL} width={CELL} height={CELL} patternUnits="userSpaceOnUse">
            <rect x="1" y="1" width="10" height="10" rx="2.5" className="fill-sticker-green" />
          </pattern>
          <pattern id="proven-no" x={LABEL} width={CELL} height={CELL} patternUnits="userSpaceOnUse">
            <rect x="1.5" y="1.5" width="9" height="9" rx="2.25" fill="none" stroke="rgb(255 255 255 / 0.2)" />
          </pattern>
        </defs>
        {PROVEN.map((n, i) => (
          <g key={i}>
            <text x={LABEL - 8} y={i * CELL + 9.5} textAnchor="end" fontSize="10" className="fill-fg-faint tabular-nums">
              {i + 2}
            </text>
            <rect x={LABEL} y={i * CELL} width={n * CELL} height={CELL} fill="url(#proven-yes)" />
            <rect x={LABEL + n * CELL} y={i * CELL} width={(20 - n) * CELL} height={CELL} fill="url(#proven-no)" />
          </g>
        ))}
      </svg>
      <figcaption className="mt-3 max-w-68 text-sm text-fg-faint">
        Each square is one test position, a number of random turns from solved. Filled: its route was proven the shortest.
      </figcaption>
    </figure>
  )
}

export function Home() {
  const done = useAcademyStore((s) => s.completed)
  const lessonsDone = LESSONS.filter((l) => done.includes(l.id)).length

  return (
    <main className="min-h-dvh overflow-x-clip bg-ink text-fg">
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6 sm:pt-7">
        <SiteNav />

        <section className="home-hero pt-8 sm:pt-12 lg:pt-10" aria-labelledby="hero-title">
          <h1
            id="hero-title"
            className="home-hero-title font-display text-[clamp(2.9rem,8vw,6.4rem)] font-extrabold leading-[0.94] tracking-[-0.03em] text-balance"
          >
            Solve the cube with your hands.
          </h1>
          <div className="home-hero-stage">
            <HeroStage />
          </div>
          <div className="home-hero-copy">
            <p className="max-w-md text-lg leading-relaxed text-pretty text-fg-muted">
              Raise a few fingers at your webcam and a layer turns. Nothing to install, and your video never leaves your device.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/play/cube3"
                data-testid="hero-play"
                className="sticker inline-flex min-h-13 items-center rounded-xl bg-sticker-yellow px-7 font-bold text-plastic transition-[translate,filter] duration-200 ease-click hover:brightness-105 active:translate-y-0.5"
              >
                Play the 3×3
              </Link>
              <Link
                to="/learn"
                className="plastic inline-flex min-h-13 items-center rounded-xl bg-raised px-7 font-bold text-fg ring-1 ring-white/10 transition-[translate,box-shadow] duration-200 ease-click hover:ring-white/25 active:translate-y-0.5"
              >
                Learn to solve it
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-20 sm:mt-28" aria-labelledby="try-title">
          <h2 id="try-title" className={H2}>
            Raise fingers. Turn a layer.
          </h2>
          <p className="mt-3 max-w-2xl text-pretty text-fg-muted">
            Your fingers pick the layer and your hand picks the direction. Tap fingers to raise them, or pick a sign, then
            hold still. With a webcam, the game reads your own hands the same way.
          </p>
          <div className="plastic mt-8 rounded-[1.75rem] p-4 sm:p-8 lg:p-10">
            <SignPlayground />
          </div>
        </section>

        <section className="mt-20 sm:mt-28" aria-labelledby="pick-title">
          <h2 id="pick-title" className={H2}>
            Pick a puzzle
          </h2>
          <div className="places mt-8">
            <Link to="/play/cube3" data-testid="play-cube3" className="place bg-sticker-green">
              <h3 className="font-display text-3xl font-extrabold tracking-tight">3×3 Cube</h3>
              <p className="mt-2 max-w-60 font-medium">The classic. Make every face one colour.</p>
              <div className="mt-auto flex items-end justify-between gap-4 pt-6">
                <span className="font-bold underline decoration-2 underline-offset-4">Play</span>
                <StickerGrid colours={SCRAMBLED} sticker={30} gap={4} />
              </div>
            </Link>
            <Link to="/play/mirror" data-testid="play-mirror" className="place bg-sticker-blue">
              <h3 className="font-display text-3xl font-extrabold tracking-tight">Mirror Cube</h3>
              <p className="mt-2 max-w-60 font-medium">One colour, uneven blocks. You solve it by shape.</p>
              <div className="mt-auto flex items-end justify-between gap-4 pt-6">
                <span className="font-bold underline decoration-2 underline-offset-4">Play</span>
                <span className="mirror-face size-26.5" aria-hidden>
                  {Array.from({ length: 9 }, (_, i) => (
                    <span key={i} />
                  ))}
                </span>
              </div>
            </Link>
            <Link to="/learn" data-testid="learn-academy" className="place bg-sticker-orange">
              <h3 className="font-display text-3xl font-extrabold tracking-tight">Academy</h3>
              <p className="mt-2 max-w-60 font-medium">Learn the layer-by-layer method in eight short lessons.</p>
              <div className="mt-auto flex items-end justify-between gap-4 pt-6">
                <span>
                  {lessonsDone > 0 && (
                    <span className="block text-sm font-medium">
                      {lessonsDone} of {LESSONS.length} lessons done
                    </span>
                  )}
                  <span className="font-bold underline decoration-2 underline-offset-4">{lessonsDone === 0 ? 'Start learning' : 'Carry on'}</span>
                </span>
                <AcademyFace done={done} />
              </div>
            </Link>
          </div>
        </section>

        <section className="mt-20 grid gap-10 sm:mt-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] lg:gap-14" aria-labelledby="built-title">
          <div className="lg:sticky lg:top-8 lg:self-start">
            <h2 id="built-title" className={H2}>
              Built from scratch.
            </h2>
            <p className="mt-4 max-w-sm text-pretty text-fg-muted">
              No server: the hand tracking, the solver and the 3D cube all run in your browser. MediaPipe finds the hand and
              three.js draws the cube; reading the sign, the solver and the Mirror Cube’s tracking were written for CubePalm.
              The numbers come from scripts in the repository that anyone can run again.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-6">
              <Link to="/how" className={`${LINK} text-sticker-red`}>
                How it works
              </Link>
              <a href={`${GITHUB}/blob/main/docs/REPORT.md`} target="_blank" rel="noreferrer" className={`${LINK} text-fg`}>
                The report
              </a>
              <a href={GITHUB} target="_blank" rel="noreferrer" className={`${LINK} text-sticker-yellow`}>
                Source on GitHub
              </a>
            </div>
          </div>
          <dl className="divide-y divide-white/10 border-y border-white/10">
            {FACTS.map((f) => (
              <div key={f.title} className="grid gap-1.5 py-6 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
                <dt className="font-display text-lg font-bold leading-snug">{f.title}</dt>
                <dd className="text-pretty text-fg-muted">
                  {f.body}
                  {f.chart && <ProofChart />}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <SiteFooter />
      </div>
    </main>
  )
}
