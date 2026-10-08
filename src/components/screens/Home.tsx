import { Link } from 'react-router-dom'
import { LESSONS } from '../../core/academy/lessons'
import { useAcademyStore } from '../../state/academyStore'
import { CssCube } from '../CssCube'
import { ColourStrip, SiteNav } from '../SiteNav'
import { Logo } from '../Logo'
import { SignPlayground } from '../SignPlayground'

const GITHUB = 'https://github.com/JayGuri/cubepalm'

// Small sticker-grid drawings for the puzzle tiles. They sit half off the edge
// of the tile, like a cube picked up from the table.
const STICKERS = ['#FFFFFF', '#FFD500', '#E5384F', '#2F6FDE', '#FF8A00', '#2FB36B']
const FACE_PATTERN = [2, 0, 5, 1, 3, 0, 5, 2, 4]

function StickerGrid() {
  return (
    <div className="grid w-36 grid-cols-3 gap-1.5 rounded-[1.4rem] bg-[#10131A] p-2.5 shadow-2xl sm:w-52 sm:gap-2 sm:rounded-[1.6rem] sm:p-3" aria-hidden>
      {FACE_PATTERN.map((c, i) => (
        <span key={i} className="aspect-square rounded-lg" style={{ background: STICKERS[c] }} />
      ))}
    </div>
  )
}

// Brushed-blue blocks of uneven sizes: the Mirror Cube in one glance.
function MirrorBlocks() {
  return (
    <div
      className="grid w-36 gap-2 rounded-[1.4rem] bg-[#10131A] p-2.5 shadow-2xl sm:w-56 sm:gap-3 sm:rounded-[1.8rem] sm:p-3.5"
      style={{ gridTemplateColumns: '1.4fr 1fr 0.6fr', gridTemplateRows: '1.25fr 1fr 0.75fr', aspectRatio: '1' }}
      aria-hidden
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="rounded-md bg-linear-to-br from-[#A9C4F7] via-[#5E8DEB] to-[#27449A]" />
      ))}
    </div>
  )
}

function LessonDots() {
  const completed = useAcademyStore((s) => s.completed)
  return (
    <div className="flex gap-1.5" aria-hidden>
      {LESSONS.map((l) => (
        <span
          key={l.id}
          className={`h-7 w-7 rounded-lg ${completed.includes(l.id) ? 'bg-[#10131A]' : 'border-2 border-[#10131A]/40'}`}
        />
      ))}
    </div>
  )
}

const TILE =
  'group relative isolate flex min-h-[17rem] flex-col md:min-h-[15rem] justify-between overflow-hidden rounded-[2rem] p-7 text-[#10131A] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)]'

const FACTS = [
  {
    title: 'Hand tracking',
    body: 'MediaPipe finds 21 points on each hand, on your device. Fingers up or down become a sign, and the sign picks a layer.',
  },
  {
    title: 'A solver of its own',
    body: 'A two-phase Kociemba solver written for this project. It keeps searching for shorter answers and averages about 25 steps.',
  },
  {
    title: 'Shape is the state',
    body: 'On the Mirror Cube every block’s position and rotation is tracked as a matrix, so the shape of the cube is the puzzle.',
  },
  {
    title: 'Checked twice',
    body: 'Moves, solutions and lessons are tested against a second cube engine, cubing.js, in over 200 unit tests.',
  },
]

export function Home() {
  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#16171B] text-[#ECEAE4]">
      <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46rem] bg-[radial-gradient(45%_45%_at_78%_32%,rgba(76,201,240,0.16),transparent),radial-gradient(35%_35%_at_58%_62%,rgba(255,213,0,0.10),transparent)]"
        />

        <SiteNav />

        <section className="grid items-center gap-4 pt-8 md:grid-cols-[1.1fr_1fr] md:pt-6">
          <div>
            <h1 className="font-display text-[clamp(3.2rem,8.4vw,6.6rem)] font-extrabold leading-[0.94] tracking-[-0.03em]">
              Solve the cube with your hands.
            </h1>
            <p className="mt-7 max-w-md text-lg leading-relaxed text-[#B2B0B9]">
              Raise a few fingers at your webcam and a layer turns. Nothing to install, and your video never leaves your
              device.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                to="/play/cube3"
                data-testid="hero-play"
                className="rounded-full bg-[#FFD500] px-8 py-3.5 font-semibold text-[#16171B] transition hover:-translate-y-0.5 hover:bg-[#FFE04D] hover:shadow-[0_12px_32px_-12px_#FFD500]"
              >
                Play now
              </Link>
              <Link
                to="/learn"
                className="rounded-full border border-white/20 px-8 py-3.5 font-semibold transition hover:-translate-y-0.5 hover:border-white/50"
              >
                Learn the method
              </Link>
            </div>
          </div>
          {/* Two cubes of the same size, side by side, each on its own clock. */}
          <div className="relative mt-4 flex h-[18rem] items-center justify-center sm:h-[30rem] md:-mt-10 md:gap-6">
            <div aria-hidden className="absolute bottom-8 left-[25%] h-7 w-48 -translate-x-1/2 rounded-[50%] bg-black/60 blur-xl sm:bottom-10" />
            <div aria-hidden className="absolute bottom-8 left-[75%] h-7 w-48 -translate-x-1/2 rounded-[50%] bg-black/60 blur-xl sm:bottom-10" />
            <div className="grid flex-1 place-items-center">
              <div className="scale-[0.6] sm:scale-[0.95] md:scale-[0.7] lg:scale-[0.85] xl:scale-100">
                <CssCube cubie={56} autoplay tumble followPointer />
              </div>
            </div>
            <div className="grid flex-1 place-items-center">
              <div className="scale-[0.6] sm:scale-[0.95] md:scale-[0.7] lg:scale-[0.85] xl:scale-100">
                <CssCube variant="mirror" cubie={56} autoplay tumble followPointer />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-24 rounded-[2.2rem] border border-white/[0.08] bg-[#1B1D22] p-6 sm:p-10" aria-labelledby="try-title">
          <h2 id="try-title" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Raise fingers. Turn a layer.
          </h2>
          <p className="mt-3 max-w-xl text-[#B2B0B9]">
            This is how the camera reads you, with a mouse standing in for your hand. Right hand turns clockwise, left hand
            turns back.
          </p>
          <div className="mt-10">
            <SignPlayground />
          </div>
        </section>

        <section className="mt-28" aria-labelledby="pick-title">
          <h2 id="pick-title" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Pick a puzzle
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3 md:grid-rows-2">
            <Link to="/play/cube3" data-testid="play-cube3" className={`${TILE} bg-[#2FB36B] md:col-span-2`}>
              <div>
                <h3 className="font-display text-4xl font-extrabold tracking-tight">3×3 Cube</h3>
                <p className="mt-2 max-w-xs text-lg font-medium text-[#10131A]/90">The classic. Make every face one colour.</p>
              </div>
              <span className="mt-6 w-fit rounded-full bg-[#10131A] px-5 py-2 text-sm font-semibold text-[#ECEAE4]">Play</span>
              <div className="absolute -bottom-8 right-4 rotate-[8deg] sm:-bottom-10 sm:right-8 transition duration-500 group-hover:-translate-y-3 group-hover:rotate-[2deg]">
                <StickerGrid />
              </div>
            </Link>

            <Link to="/play/mirror" data-testid="play-mirror" className={`${TILE} bg-[#5B8DEF] md:row-span-2`}>
              <div>
                <h3 className="font-display text-4xl font-extrabold tracking-tight">Mirror Cube</h3>
                <p className="mt-2 max-w-[15rem] text-lg font-medium text-[#10131A]/90">
                  One colour, uneven blocks. You solve it by shape.
                </p>
              </div>
              <span className="mt-6 w-fit rounded-full bg-[#10131A] px-5 py-2 text-sm font-semibold text-[#ECEAE4]">Play</span>
              <div className="absolute -bottom-10 -right-8 -rotate-[8deg] sm:-bottom-16 sm:-right-12 transition duration-500 group-hover:-translate-y-3 group-hover:-rotate-[3deg]">
                <MirrorBlocks />
              </div>
            </Link>

            <Link to="/learn" data-testid="learn-academy" className={`${TILE} bg-[#FF8A00] md:col-span-2`}>
              <div>
                <h3 className="font-display text-4xl font-extrabold tracking-tight">Academy</h3>
                <p className="mt-2 max-w-xs text-lg font-medium text-[#10131A]/90">
                  Learn the layer-by-layer method in eight short lessons.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <span className="rounded-full bg-[#10131A] px-5 py-2 text-sm font-semibold text-[#ECEAE4]">Start learning</span>
                <LessonDots />
              </div>
            </Link>
          </div>
        </section>

        <section className="mt-28 grid gap-12 md:grid-cols-[1fr_1.7fr]" aria-labelledby="built-title">
          <div>
            <h2 id="built-title" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Built from scratch.
            </h2>
            <p className="mt-4 max-w-sm text-[#B2B0B9]">
              CubePalm has no server. The tracking, the solver and the 3D all run in your browser.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <a href={`${GITHUB}/blob/main/docs/MATH.md`} target="_blank" rel="noreferrer" className="text-[#4CC9F0] underline-offset-4 hover:underline">
                Read the maths
              </a>
              <a href={GITHUB} target="_blank" rel="noreferrer" className="text-[#FFD500] underline-offset-4 hover:underline">
                See the source
              </a>
            </div>
          </div>
          <dl className="divide-y divide-white/10 border-y border-white/10">
            {FACTS.map((f) => (
              <div key={f.title} className="grid gap-1 py-5 sm:grid-cols-[11rem_1fr] sm:gap-6">
                <dt className="font-display text-lg font-bold">{f.title}</dt>
                <dd className="text-[#B2B0B9]">{f.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="mt-28 border-t border-white/10 pt-8 text-sm text-[#9C9AA3]">
          <ColourStrip />
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <span className="text-[#ECEAE4]"><Logo size={32} /></span>
            <p>
              Made by{' '}
              <a href="https://github.com/JayGuri" target="_blank" rel="noreferrer" className="text-[#ECEAE4] underline decoration-white/40 underline-offset-4 hover:decoration-white">
                Jay Guri
              </a>
              . Runs entirely in your browser.
            </p>
          </div>
        </footer>
      </div>
    </main>
  )
}
