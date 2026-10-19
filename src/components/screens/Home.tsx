import type { CSSProperties } from 'react'
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
    <div className="grid w-36 grid-cols-3 gap-1.5 rounded-[1.4rem] bg-[#10131A] p-2.5 shadow-2xl sm:w-44 sm:gap-2 sm:rounded-[1.6rem] sm:p-3 md:w-40 lg:w-52" aria-hidden>
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
      className="grid w-36 gap-2 rounded-[1.4rem] bg-[#10131A] p-2.5 shadow-2xl sm:w-48 sm:gap-3 sm:rounded-[1.8rem] sm:p-3.5 md:w-40 lg:w-56"
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
          className={`h-5 w-5 rounded-md sm:h-7 sm:w-7 sm:rounded-lg ${completed.includes(l.id) ? 'bg-[#10131A]' : 'border-2 border-[#10131A]/40'}`}
        />
      ))}
    </div>
  )
}

// One hero cube, with its shadow on the floor beneath it. The cube is drawn
// around a point, so the shadow is placed from that point and scales with it.
function HeroCube({ variant }: { variant?: 'mirror' }) {
  return (
    <div className="grid flex-1 place-items-center">
      <div className="relative scale-[0.55] min-[400px]:scale-[0.62] sm:scale-[0.9] md:scale-[0.6] lg:scale-[0.8] xl:scale-100">
        <div aria-hidden className="absolute left-1/2 top-[165px] h-8 w-52 -translate-x-1/2 rounded-[50%] bg-black/55 blur-xl" />
        <CssCube variant={variant} cubie={56} autoplay tumble followPointer />
      </div>
    </div>
  )
}

const TILE =
  'group relative isolate flex min-h-[17rem] flex-col justify-between overflow-hidden rounded-[2rem] p-6 text-[#10131A] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)] sm:p-7 md:min-h-[15rem]'
const TILE_TITLE = 'font-display text-[2.1rem] font-extrabold leading-none tracking-tight sm:text-4xl'
const TILE_BODY = 'mt-3 text-lg font-medium text-[#10131A]/90'
const TILE_PILL = 'relative z-10 w-fit rounded-full bg-[#10131A] px-5 py-2 text-sm font-semibold text-[#ECEAE4]'

const H2 = 'font-display text-3xl font-bold tracking-tight sm:text-4xl'

// Every number here comes from docs/REPORT.md, which comes from scripts in research/.
const FACTS = [
  {
    title: 'Hand tracking',
    body: 'MediaPipe finds 21 points on each hand, on your device. Four fingers, each up or down, make a sign, and the sign picks a layer.',
  },
  {
    title: 'Measured signs',
    body: 'Sign reading was tested on a posable hand model. That found a units error in the geometry: correcting it raised the signs read on the model from 75.4% to 89.9%.',
  },
  {
    title: 'A solver of its own',
    body: 'A two-phase solver written for this project. Its first route arrives in about 29 ms, and it keeps looking: after five seconds, routes average 24.7 quarter turns.',
  },
  {
    title: 'Shape is the state',
    body: 'On the Mirror Cube every block’s position and rotation is tracked as a matrix, so the shape of the cube is the puzzle.',
  },
  {
    title: 'Checked twice',
    body: 'All 460 routes from the solver benchmark were replayed in cubing.js, a separate cube engine, and every one solved its cube.',
  },
]

const LINK = 'inline-flex min-h-11 items-center underline decoration-current/40 underline-offset-4 hover:decoration-current'

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

export function Home() {
  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#16171B] text-[#ECEAE4]">
      <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6 sm:pt-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46rem] bg-[radial-gradient(45%_45%_at_78%_32%,rgba(76,201,240,0.16),transparent),radial-gradient(35%_35%_at_58%_62%,rgba(255,213,0,0.10),transparent)]"
        />

        <SiteNav />

        <section className="grid items-center gap-2 pt-10 md:grid-cols-[1.1fr_1fr] md:gap-4 md:pt-14 lg:pt-16">
          <div>
            <h1 className="font-display text-[clamp(3rem,8.4vw,6.6rem)] font-extrabold leading-[0.94] tracking-[-0.03em] text-balance">
              Solve the cube with your hands.
            </h1>
            <p className="hero-in mt-6 max-w-md text-lg leading-relaxed text-pretty text-[#B2B0B9] sm:mt-7" style={delay(120)}>
              Raise a few fingers at your webcam and a layer turns. Nothing to install, and your video never leaves your
              device.
            </p>
            <div className="hero-in mt-8 flex flex-wrap gap-3 sm:mt-9" style={delay(220)}>
              <Link
                to="/play/cube3"
                data-testid="hero-play"
                className="inline-flex min-h-13 items-center rounded-full bg-[#FFD500] px-8 font-semibold text-[#16171B] transition hover:-translate-y-0.5 hover:bg-[#FFE04D] hover:shadow-[0_12px_32px_-12px_#FFD500]"
              >
                Play now
              </Link>
              <Link
                to="/learn"
                className="inline-flex min-h-13 items-center rounded-full border border-white/25 px-8 font-semibold transition hover:-translate-y-0.5 hover:border-white/60"
              >
                Learn the method
              </Link>
            </div>
          </div>
          {/* The two puzzles, side by side, each on its own clock. */}
          <div className="hero-in relative flex h-[17rem] items-center justify-center min-[400px]:h-[19rem] sm:h-[28rem] md:-mt-8 md:h-[24rem] md:gap-4 lg:h-[30rem]" style={delay(320)}>
            <HeroCube />
            <HeroCube variant="mirror" />
          </div>
        </section>

        <section className="mt-16 rounded-[2rem] border border-white/[0.08] bg-[#1B1D22] p-5 sm:mt-24 sm:p-10" aria-labelledby="try-title">
          <h2 id="try-title" className={H2}>
            Raise fingers. Turn a layer.
          </h2>
          <p className="mt-3 max-w-xl text-pretty text-[#B2B0B9]">
            Tap fingers to raise them, or pick a sign. Hold it for a moment and that layer turns: the right hand turns
            clockwise, the left hand turns back. In the game, your webcam reads your own hand the same way.
          </p>
          <div className="mt-8 sm:mt-10">
            <SignPlayground />
          </div>
        </section>

        <section className="mt-20 sm:mt-28" aria-labelledby="pick-title">
          <h2 id="pick-title" className={H2}>
            Pick a puzzle
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3 md:grid-rows-2">
            <Link to="/play/cube3" data-testid="play-cube3" className={`${TILE} bg-[#2FB36B] md:col-span-2`}>
              <div className="relative z-10">
                <h3 className={TILE_TITLE}>3×3 Cube</h3>
                <p className={`${TILE_BODY} max-w-[13rem] sm:max-w-xs md:max-w-[15rem] lg:max-w-xs`}>The classic. Make every face one colour.</p>
              </div>
              <span className={`${TILE_PILL} mt-6`}>Play</span>
              <div className="absolute -bottom-8 right-4 rotate-[8deg] transition duration-500 group-hover:-translate-y-3 group-hover:rotate-[2deg] sm:-bottom-10 sm:right-8">
                <StickerGrid />
              </div>
            </Link>

            <Link to="/play/mirror" data-testid="play-mirror" className={`${TILE} bg-[#5B8DEF] md:row-span-2`}>
              <div className="relative z-10">
                <h3 className={TILE_TITLE}>Mirror Cube</h3>
                <p className={`${TILE_BODY} max-w-[13rem] sm:max-w-[15rem]`}>One colour, uneven blocks. You solve it by shape.</p>
              </div>
              <span className={`${TILE_PILL} mt-6`}>Play</span>
              <div className="absolute -bottom-10 -right-8 -rotate-[8deg] transition duration-500 group-hover:-translate-y-3 group-hover:-rotate-[3deg] sm:-bottom-14 sm:-right-10">
                <MirrorBlocks />
              </div>
            </Link>

            <Link to="/learn" data-testid="learn-academy" className={`${TILE} bg-[#FF8A00] md:col-span-2`}>
              <div>
                <h3 className={TILE_TITLE}>Academy</h3>
                <p className={`${TILE_BODY} max-w-xs`}>Learn the layer-by-layer method in eight short lessons.</p>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <span className={TILE_PILL}>Start learning</span>
                <LessonDots />
              </div>
            </Link>
          </div>
        </section>

        <section className="mt-20 grid gap-10 sm:mt-28 lg:grid-cols-[1fr_1.7fr] lg:gap-12" aria-labelledby="built-title">
          <div>
            <h2 id="built-title" className={H2}>
              Built from scratch.
            </h2>
            <p className="mt-4 max-w-sm text-pretty text-[#B2B0B9]">
              CubePalm has no server. The tracking, the solver and the 3D all run in your browser. The numbers here come
              from scripts in the repository that anyone can run again.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-6 text-[0.95rem] font-semibold">
              <a href={`${GITHUB}/blob/main/docs/REPORT.md`} target="_blank" rel="noreferrer" className={`${LINK} text-[#ECEAE4]`}>
                Read the report
              </a>
              <a href={`${GITHUB}/blob/main/docs/MATH.md`} target="_blank" rel="noreferrer" className={`${LINK} text-[#4CC9F0]`}>
                The maths
              </a>
              <a href={GITHUB} target="_blank" rel="noreferrer" className={`${LINK} text-[#FFD500]`}>
                Source
              </a>
            </div>
          </div>
          <dl className="divide-y divide-white/10 border-y border-white/10">
            {FACTS.map((f) => (
              <div key={f.title} className="grid gap-1 py-5 sm:grid-cols-[11rem_1fr] sm:gap-6">
                <dt className="font-display text-lg font-bold">{f.title}</dt>
                <dd className="text-pretty text-[#B2B0B9]">{f.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="mt-20 border-t border-white/10 pt-8 text-sm text-[#9C9AA3] sm:mt-28">
          <ColourStrip />
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <span className="text-[#ECEAE4]">
              <Logo size={32} />
            </span>
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
