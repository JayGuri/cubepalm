import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LESSONS, type Lesson } from '../../core/academy/lessons'
import { useAcademyStore } from '../../state/academyStore'
import { SiteNav } from '../SiteNav'
import { SiteFooter } from '../shell/SiteFooter'
import { GoalCube } from '../academy/GoalCube'
import { ProgressFace } from '../academy/ProgressFace'
import '../../styles/academy.css'

// The lesson list: one path from "meet the cube" to a solved cube. Where you
// are is a face of the cube being solved, one sticker per lesson; what to do
// next is the one yellow button beside it. The lessons are grouped by the
// layer they solve, each with a small cube showing what it makes.

const GROUPS: { title: string; text: string; ids: string[] }[] = [
  { title: 'The basics', text: 'What the pieces are, and how a turn is written.', ids: ['basics'] },
  { title: 'First layer', text: 'White on the bottom, with the colours round its edge matching.', ids: ['cross', 'corners'] },
  { title: 'Second layer', text: 'The middle ring of edge pieces.', ids: ['middle'] },
  { title: 'Last layer', text: 'Yellow on top, then every piece home.', ids: ['top-cross', 'top-face', 'top-corners', 'top-edges'] },
]

const PRIMARY =
  'sticker inline-flex min-h-12 items-center rounded-xl bg-sticker-yellow px-6 font-semibold text-plastic transition-[transform,background-color] duration-200 ease-click hover:bg-[#ffe04d] active:translate-y-0.5'
const SECONDARY = 'inline-flex min-h-12 items-center rounded-xl bg-raised px-5 font-medium text-fg transition hover:bg-[#2a2d34] active:translate-y-0.5'
const SMALL = 'inline-flex min-h-9 items-center rounded-lg px-4 text-sm font-semibold transition active:translate-y-px pointer-coarse:min-h-11'

export function Academy() {
  const completed = useAcademyStore((s) => s.completed)
  const reset = useAcademyStore((s) => s.reset)
  const [confirming, setConfirming] = useState(false)
  const nextIndex = LESSONS.findIndex((l) => !completed.includes(l.id))
  const next = LESSONS[nextIndex]
  const finished = nextIndex === -1
  const doneCount = LESSONS.filter((l) => completed.includes(l.id)).length
  const started = doneCount > 0

  return (
    <main className="min-h-dvh bg-ink text-fg">
      <div className="mx-auto max-w-3xl px-4 pb-10 pt-6 sm:px-6 sm:pt-8">
        <SiteNav size={40} />

        <header className="mt-10 grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-7 sm:mt-14 sm:grid-cols-[1fr_auto] sm:gap-x-12">
          <div className="col-span-2 sm:col-span-1">
            <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">{finished ? 'You can solve it.' : 'Learn to solve it.'}</h1>
            <p className="mt-5 max-w-lg text-lg text-fg-faint">
              {finished
                ? 'All eight lessons done. That is the whole layer-by-layer method, from a white cross to a solved cube.'
                : 'Never solved a cube? Start here. Eight short lessons take you there one layer at a time: watch the moves on a small cube, then make them on a big one, with help whenever you are stuck.'}
            </p>
          </div>

          {/* Where you are: the course as one face of a cube, solving one sticker per lesson. */}
          <figure className="flex flex-col items-center gap-2.5 sm:col-start-2 sm:row-span-2 sm:row-start-1">
            <ProgressFace done={completed} sticker={44} gap={6} className="max-sm:zoom-[0.66]" />
            <figcaption data-testid="academy-progress" className="text-sm tabular-nums text-fg-faint">
              {doneCount} of {LESSONS.length} done
            </figcaption>
          </figure>

          {/* What to do next. */}
          {finished ? (
            <div className="sm:col-start-1">
              <p className="font-display text-xl font-bold">Now try a real scramble.</p>
              <p className="mt-1 max-w-md text-fg-muted">Mix the cube up and solve it layer by layer. The first one is slow for everyone. Stuck? Guide me shows the next move.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link to="/play/cube3" data-testid="academy-continue" className={PRIMARY}>
                  Solve a scrambled cube
                </Link>
                <Link to="/play/mirror" className={SECONDARY}>
                  Try the Mirror Cube
                </Link>
              </div>
            </div>
          ) : (
            <div className="min-w-0 sm:col-start-1">
              <Link to={`/learn/${next.id}`} data-testid="academy-continue" className={PRIMARY}>
                {started ? `Continue with lesson ${nextIndex + 1}` : 'Start lesson 1'}
              </Link>
              <p className="mt-2 text-sm text-fg-faint">
                {started ? 'Next' : 'First'}: {next.title}
              </p>
            </div>
          )}
        </header>

        <h2 className="sr-only">Lessons</h2>
        <p className="mt-14 max-w-lg text-fg-muted sm:mt-16">The method: solve the bottom layer first, then the middle, then the top. Each lesson adds a few pieces.</p>
        <div className="mt-6 space-y-8">
          {GROUPS.map((g) => (
            <section key={g.title} aria-labelledby={`group-${g.ids[0]}`}>
              <h3 id={`group-${g.ids[0]}`} className="font-display text-xl font-bold">
                {g.title}
              </h3>
              <p className="mt-0.5 text-sm text-fg-faint">{g.text}</p>
              <ol className="mt-3 space-y-2">
                {g.ids.map((id) => {
                  const i = LESSONS.findIndex((l) => l.id === id)
                  return <LessonRow key={id} lesson={LESSONS[i]} number={i + 1} done={completed.includes(id)} current={i === nextIndex} started={started} />
                })}
              </ol>
            </section>
          ))}
        </div>

        {started && (
          <div className="mt-10" aria-live="polite">
            {confirming ? (
              <div className="plastic rounded-xl p-4">
                <p>
                  Clear {doneCount === 1 ? 'your finished lesson' : `all ${doneCount} finished lessons`}? The lessons stay open; only the ticks go.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      reset()
                      setConfirming(false)
                    }}
                    className={`${SMALL} sticker bg-sticker-red text-plastic hover:bg-[#f37586]`}
                  >
                    Yes, clear it
                  </button>
                  <button type="button" autoFocus onClick={() => setConfirming(false)} className={`${SMALL} bg-raised text-fg hover:bg-[#2a2d34]`}>
                    Keep my progress
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex min-h-9 items-center text-sm text-fg-faint underline-offset-4 hover:text-fg hover:underline pointer-coarse:min-h-11"
              >
                Clear my progress
              </button>
            )}
          </div>
        )}

        <SiteFooter />
      </div>
    </main>
  )
}

function LessonRow({ lesson, number, done, current, started }: { lesson: Lesson; number: number; done: boolean; current: boolean; started: boolean }) {
  return (
    <li>
      <Link
        to={`/learn/${lesson.id}`}
        data-testid={`lesson-${lesson.id}`}
        aria-current={current ? 'step' : undefined}
        className={`group plastic flex items-center gap-3.5 rounded-xl p-2 pr-4 transition-colors hover:bg-[#21242a] sm:gap-4 ${current ? 'ring-1 ring-inset ring-sticker-orange/70' : ''}`}
      >
        {/* What the lesson makes: its pieces in colour, the rest grey. */}
        <span aria-hidden className="grid size-16 shrink-0 place-items-center rounded-lg bg-ink">
          <GoalCube lessonId={lesson.id} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2.5">
            <span className="font-display text-lg font-bold leading-tight">
              <span className="mr-2 tabular-nums text-fg-faint">{number}</span>
              <span className="sr-only">Lesson {number}: </span>
              {lesson.title}
            </span>
            {current && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-sticker-orange">
                <span aria-hidden className="sticker size-2.5 rounded-[3px] bg-sticker-orange" />
                {started ? 'Up next' : 'Start here'}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-[15px] leading-snug text-fg-faint">{lesson.blurb}</span>
        </span>
        {done ? (
          <span className="sticker grid size-6 shrink-0 place-items-center rounded-[5px] bg-sticker-orange text-plastic">
            <svg width="13" height="13" viewBox="0 0 18 18" aria-hidden>
              <path d="m3 9.5 4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="sr-only">(done)</span>
          </span>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0 text-fg-faint transition-colors group-hover:text-fg">
            <path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </Link>
    </li>
  )
}
