import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LESSONS } from '../../core/academy/lessons'
import { useAcademyStore } from '../../state/academyStore'
import { SiteNav } from '../SiteNav'

// The lesson list. One path from "meet the cube" to a solved cube.

const PRIMARY =
  'inline-flex min-h-12 items-center rounded-full bg-[#FFD500] px-7 font-semibold text-[#16171B] transition hover:-translate-y-0.5 hover:bg-[#FFE04D]'
const SECONDARY =
  'inline-flex min-h-12 items-center rounded-full border border-white/20 px-6 font-medium text-[#ECEAE4] transition hover:border-white/50'
const SMALL =
  'inline-flex min-h-9 items-center rounded-full px-4 text-sm font-medium transition pointer-coarse:min-h-11'

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
    <main className="min-h-dvh bg-[#16171B] text-[#ECEAE4]">
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
        <SiteNav size={40} />

        <header className="mt-12 sm:mt-14">
          <h1 className="font-display min-h-[3.2rem] text-5xl font-extrabold leading-[1.02] tracking-tight sm:min-h-[3.8rem] sm:text-6xl">
            {finished ? 'You can solve it.' : 'Learn to solve it.'}
          </h1>
          <p className="mt-5 min-h-18 max-w-lg text-lg text-[#9C9AA3] sm:min-h-14">
            {finished
              ? 'All eight lessons done. That is the whole layer-by-layer method, from a white cross to a solved cube.'
              : 'Eight short lessons, one layer at a time. Each has practice positions and a button that walks you through the moves on the cube.'}
          </p>

          {finished ? (
            <div className="mt-8 rounded-2xl border border-[#2FB36B]/40 bg-[#2FB36B]/10 p-5 sm:p-6">
              <p className="font-display text-xl font-bold text-[#4ED48A]">Now try a real scramble.</p>
              <p className="mt-1 max-w-md text-[#C9C7CF]">
                Mix the cube up and solve it layer by layer. The first one is slow for everyone. If you get stuck, Guide me shows the next move.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link to="/play/cube3" data-testid="academy-continue" className={PRIMARY}>
                  Solve a scrambled cube
                </Link>
                <Link to="/play/mirror" className={SECONDARY}>
                  Try the Mirror Cube
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-4">
              <Link to={`/learn/${next.id}`} data-testid="academy-continue" className={PRIMARY}>
                {started ? `Continue with lesson ${nextIndex + 1}` : 'Start lesson 1'}
              </Link>
              <Progress done={completed} count={doneCount} />
            </div>
          )}
        </header>

        <h2 className="sr-only">Lessons</h2>
        <ol className="relative mt-12 space-y-3 sm:mt-14">
          {/* The thread through the lesson numbers. */}
          <span className="absolute bottom-8 left-9.75 top-8 w-px bg-white/10" aria-hidden />
          {LESSONS.map((lesson, i) => {
            const done = completed.includes(lesson.id)
            const current = i === nextIndex
            return (
              <li key={lesson.id}>
                <Link
                  to={`/learn/${lesson.id}`}
                  data-testid={`lesson-${lesson.id}`}
                  aria-current={current ? 'step' : undefined}
                  className={`group relative flex items-center gap-4 rounded-2xl border p-4 transition hover:-translate-y-0.5 sm:gap-5 ${
                    current ? 'border-[#FF8A00]/60 bg-[#24211D] hover:border-[#FF8A00]' : 'border-white/[0.07] bg-[#1B1D22] hover:border-white/20'
                  }`}
                >
                  <span
                    className={`font-display relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-extrabold ${
                      done ? 'bg-[#2FB36B] text-[#16171B]' : current ? 'bg-[#FF8A00] text-[#16171B]' : 'bg-[#2A2D34] text-[#B5B3BC]'
                    }`}
                  >
                    {done ? (
                      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                        <path d="m3 9.5 4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-display block text-lg font-bold leading-tight">
                      <span className="sr-only">Lesson {i + 1}: </span>
                      {lesson.title}
                      {current && (
                        <span className="ml-2 inline-block -translate-y-0.5 rounded-full bg-[#FF8A00]/15 px-2 py-0.5 align-middle font-sans text-xs font-semibold text-[#FFA94D]">
                          {started ? 'Up next' : 'Start here'}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[#9C9AA3]">{lesson.blurb}</span>
                  </span>
                  {done && <span className="sr-only">(done)</span>}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    aria-hidden
                    className="shrink-0 text-[#6E6C75] transition group-hover:translate-x-0.5 group-hover:text-[#ECEAE4]"
                  >
                    <path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </li>
            )
          })}
        </ol>

        {started && (
          <div className="mt-8" aria-live="polite">
            {confirming ? (
              <div className="rounded-xl border border-white/10 bg-[#1B1D22] p-4">
                <p className="text-[#ECEAE4]">
                  Clear {doneCount === 1 ? 'your finished lesson' : `all ${doneCount} finished lessons`}? The lessons stay open; only the ticks go.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      reset()
                      setConfirming(false)
                    }}
                    className={`${SMALL} bg-[#F0566B] text-[#16171B] hover:bg-[#F37586]`}
                  >
                    Yes, clear it
                  </button>
                  <button type="button" autoFocus onClick={() => setConfirming(false)} className={`${SMALL} border border-white/20 text-[#ECEAE4] hover:border-white/50`}>
                    Keep my progress
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex min-h-9 items-center text-sm text-[#9C9AA3] underline-offset-4 hover:text-[#ECEAE4] hover:underline pointer-coarse:min-h-11"
              >
                Clear my progress
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

/** One tile per lesson, filled in as each is finished. */
function Progress({ done, count }: { done: string[]; count: number }) {
  return (
    <span className="flex items-center gap-3 text-sm text-[#9C9AA3]" data-testid="academy-progress">
      <span className="flex gap-1" aria-hidden>
        {LESSONS.map((l) => (
          <span key={l.id} className={`h-2.5 w-3 rounded-[3px] ${done.includes(l.id) ? 'bg-[#2FB36B]' : 'bg-white/12'}`} />
        ))}
      </span>
      <span>
        {count} of {LESSONS.length} done
      </span>
    </span>
  )
}
