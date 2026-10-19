import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { LESSONS, type Lesson } from '../core/academy/lessons'
import { HAND_COLOR } from '../core/gestures/signGestures'
import type { StageProgress } from '../core/academy/stages'
import { useAcademyStore } from '../state/academyStore'
import { SignSequence } from './HandsGuide'

// The teaching column beside the cube in an Academy lesson: what to do, the
// live goal, ways to practise, the algorithm and its finger signs. On a phone
// it sits above the cube and scrolls on its own, so the parts you act on
// (goal, practice, the finished message) come before the reading.

interface Props {
  lesson: Lesson
  index: number
  caseNumber: number
  done: boolean
  note: string | null
  /** Step-by-step guide is showing. */
  guiding: boolean
  /** A demo is playing. */
  watching: boolean
  progress: StageProgress
  /** The moves to show as hand signs: the lesson's algorithm, or this position's solution. */
  signMoves: string
  onWatch: () => void
  onGuide: () => void
  onSelectCase: (index: number) => void
}

const ACTION =
  'inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm font-medium text-[#ECEAE4] transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:min-h-11'
const NAV = 'inline-flex min-h-10 items-center text-sm text-[#9C9AA3] hover:text-[#ECEAE4] pointer-coarse:min-h-11'
const LABEL = 'text-sm font-semibold text-[#ECEAE4]'

const FACE: Record<string, string> = { R: 'Right', L: 'Left', U: 'Up', D: 'Down', F: 'Front', B: 'Back' }

/** "R U' F2" in words: "Right, Up back, Front twice". */
function inWords(moves: string): string {
  return (moves.match(/[URFDLB]2?'?/g) ?? [])
    .map((m) => {
      const face = FACE[m[0]]
      if (m.includes('2')) return `${face} twice`
      if (m.endsWith("'")) return face === 'Back' ? 'Back, reversed' : `${face} back`
      return face
    })
    .join(', ')
}

export function LessonPanel({ lesson, index, caseNumber, done, note, guiding, watching, progress, signMoves, onWatch, onGuide, onSelectCase }: Props) {
  const completed = useAcademyStore((s) => s.completed)
  const hasPractice = lesson.cases.length > 0
  const prev = LESSONS[index - 1]
  const next = LESSONS[index + 1]
  const fraction = progress.total ? progress.done / progress.total : 0

  // On a phone the panel is short and scrolls by itself: bring a new
  // "complete" message or wrong-move note into view inside it.
  const alertRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!done && !note) return
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    alertRef.current?.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' })
  }, [done, note])

  return (
    <aside
      data-testid="lesson-panel"
      className="flex max-h-[46%] shrink-0 flex-col overflow-y-auto overscroll-contain border-b border-white/[0.07] bg-[#1B1D22] px-4 pb-4 pt-2 sm:px-5 md:max-h-none md:w-92 md:border-b-0 md:border-r md:pb-5 md:pt-3"
    >
      <div className="flex items-center gap-3">
        <p className="shrink-0 text-sm font-semibold text-[#FFA94D]">
          Lesson {index + 1} of {LESSONS.length}
        </p>
        {/* On a phone eight dots are too narrow to tap; they only show where you are, and Back / Skip move between lessons. */}
        <div aria-hidden className="flex flex-1 items-center gap-1 sm:hidden">
          {LESSONS.map((l, i) => (
            <span key={l.id} className={`h-2 flex-1 rounded-full ${i === index ? 'bg-[#FF8A00]' : completed.includes(l.id) ? 'bg-[#2FB36B]' : 'bg-white/15'}`} />
          ))}
        </div>
        <nav aria-label="Lessons" className="flex flex-1 items-center gap-1 max-sm:hidden">
          {LESSONS.map((l, i) => (
            <Link
              key={l.id}
              to={`/learn/${l.id}`}
              title={l.title}
              aria-label={`Lesson ${i + 1}: ${l.title}${completed.includes(l.id) ? ' (done)' : ''}`}
              aria-current={i === index ? 'step' : undefined}
              className="group flex h-8 flex-1 items-center pointer-coarse:h-11"
            >
              <span
                className={`h-2 w-full rounded-full transition ${
                  i === index ? 'bg-[#FF8A00]' : completed.includes(l.id) ? 'bg-[#2FB36B]' : 'bg-white/15 group-hover:bg-white/35'
                }`}
              />
            </Link>
          ))}
        </nav>
      </div>
      <h1 className="font-display text-xl font-bold leading-tight md:text-2xl">{lesson.title}</h1>

      <section className="mt-2 rounded-xl border border-white/10 bg-[#16171B] p-3 md:mt-4 md:p-4" aria-label="Goal">
        <p className="text-[15px] leading-snug text-[#ECEAE4]">
          <span className="text-[#9C9AA3] md:mb-0.5 md:block md:text-sm">
            Your goal<span className="md:hidden">:</span>
          </span>{' '}
          {lesson.goalText}
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
          aria-label={progress.unit}
          className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/10 md:mt-3"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${done ? 'bg-[#2FB36B]' : 'bg-[#FF8A00]'}`}
            style={{ width: `${(done ? 1 : fraction) * 100}%` }}
          />
        </div>
        <p data-testid="lesson-progress" className="mt-1.5 text-sm tabular-nums text-[#9C9AA3]">
          {progress.done} of {progress.total} {progress.unit}
        </p>
      </section>

      <div ref={alertRef} className="scroll-my-3">
      {done && (
        <div data-testid="lesson-done" className="mt-3 rounded-xl border border-[#2FB36B]/40 bg-[#2FB36B]/10 p-4" role="status">
          <p className="font-display text-lg font-bold text-[#4ED48A]">{next ? 'Lesson complete' : 'You solved the cube'}</p>
          <p className="mt-0.5 text-sm text-[#C9C7CF]">
            {!next ? 'You have learned the whole method. Now solve one from a real scramble.' : hasPractice ? 'Try another practice position, or move on when you are ready.' : 'Move on when you are ready.'}
          </p>
          {next ? (
            <Link
              to={`/learn/${next.id}`}
              data-testid="next-lesson"
              className="mt-3 inline-flex min-h-10 items-center rounded-full bg-[#FFD500] px-5 text-sm font-semibold text-[#16171B] hover:bg-[#FFE04D] pointer-coarse:min-h-11"
            >
              Next: {next.title}
            </Link>
          ) : (
            <Link
              to="/play/cube3"
              className="mt-3 inline-flex min-h-10 items-center rounded-full bg-[#FFD500] px-5 text-sm font-semibold text-[#16171B] hover:bg-[#FFE04D] pointer-coarse:min-h-11"
            >
              Solve a scrambled cube
            </Link>
          )}
        </div>
      )}

      {note && (
        <p data-testid="lesson-note" role="status" className="mt-3 rounded-lg bg-[#F5B83D]/10 px-3 py-2 text-sm text-[#F5B83D]">
          {note}
        </p>
      )}
      </div>

      {hasPractice && (
        <section className="mt-4" aria-labelledby="practice-label">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p id="practice-label" className={LABEL}>
              Practice position
            </p>
            <div className="flex gap-1.5">
              {lesson.cases.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  data-testid={`case-${i + 1}`}
                  aria-pressed={caseNumber === i + 1}
                  aria-label={`Practice position ${i + 1}`}
                  onClick={() => onSelectCase(i)}
                  className={`font-display h-9 w-9 rounded-lg font-bold transition pointer-coarse:h-11 pointer-coarse:w-11 ${
                    caseNumber === i + 1 ? 'bg-[#FF8A00] text-[#16171B]' : 'bg-white/10 text-[#ECEAE4] hover:bg-white/20'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-sm text-[#9C9AA3]">Solve it on the cube yourself, or get help:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="watch-it"
              className={ACTION}
              onClick={onWatch}
              disabled={guiding || done}
              title="Plays the whole solution for you to watch"
            >
              Watch it
            </button>
            <button
              type="button"
              data-testid="show-me"
              className={ACTION}
              onClick={onGuide}
              disabled={guiding || watching || done}
              title="Marks each move on the cube for you to copy"
            >
              Step by step
            </button>
          </div>
        </section>
      )}

      <section className="mt-5" aria-labelledby="how-label">
        <h2 id="how-label" className={LABEL}>
          How to do it
        </h2>
        {index > 0 && <p className="mt-1 text-sm text-[#9C9AA3]">Hold the cube with white on the bottom and yellow on top.</p>}
        <ol className="mt-3 space-y-3 text-[15px] leading-relaxed text-[#C9C7CF]">
          {lesson.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="font-display mt-0.5 w-5 shrink-0 text-lg font-bold leading-none text-[#FF8A00]" aria-hidden>
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {lesson.algorithm && (
        <section className="mt-5 rounded-xl border border-white/10 bg-[#16171B] p-4" aria-labelledby="alg-label">
          <h2 id="alg-label" className={LABEL}>
            {lesson.algorithm.name}
          </h2>
          <p data-testid="lesson-algorithm" className="mt-1.5 wrap-break-word font-mono text-xl leading-snug tracking-wide text-[#ECEAE4]">
            {lesson.algorithm.moves}
          </p>
          <p className="mt-1.5 text-sm text-[#C9C7CF]">{inWords(lesson.algorithm.moves)}</p>
          <p className="mt-2 border-t border-white/[0.07] pt-2 text-sm text-[#9C9AA3]">{lesson.algorithm.hint}</p>
        </section>
      )}

      {signMoves && (
        <section className="mt-5" data-testid="lesson-signs" aria-labelledby="signs-label">
          <h2 id="signs-label" className={LABEL}>
            With your hands
          </h2>
          <p className="mt-1 text-sm text-[#9C9AA3]">
            The <b style={{ color: HAND_COLOR.Right }}>right hand</b> turns clockwise, the <b style={{ color: HAND_COLOR.Left }}>left hand</b>{' '}
            counter-clockwise. Raise the lit fingers and hold.
          </p>
          <div className="mt-2">
            <SignSequence moves={signMoves} />
          </div>
        </section>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 pt-5">
        {prev ? (
          <Link to={`/learn/${prev.id}`} className={NAV}>
            <span aria-hidden className="mr-1.5">
              ←
            </span>
            Back: {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next && !done && (
          <Link to={`/learn/${next.id}`} className={NAV}>
            Skip ahead
            <span aria-hidden className="ml-1.5">
              →
            </span>
          </Link>
        )}
      </div>
    </aside>
  )
}
