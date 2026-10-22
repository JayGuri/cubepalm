import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LESSONS, type Lesson } from '../core/academy/lessons'
import { HAND_COLOR } from '../core/gestures/signGestures'
import type { StageProgress } from '../core/academy/stages'
import { useAcademyStore } from '../state/academyStore'
import { prefersReducedMotion } from '../motion/stagger'
import { SignSequence } from './HandsGuide'
import { StickerGrid } from './cube/StickerGrid'
import { GoalCube } from './academy/GoalCube'
import { MoveText, MovesDemo } from './academy/MovesDemo'
import { NotationPrimer, PrimerButton } from './academy/NotationPrimer'
import { rememberProgress } from './academy/progress'
import { TopFacePictures } from './academy/TopFace'
import '../styles/academy.css'

// The teaching column beside the cube in an Academy lesson, in the order a
// beginner needs it: what you are making (a picture, and stickers that turn
// over as pieces land), then the practice controls, then how to do it, the
// moves (seen on a small cube before they are tried), and the hand signs. On a
// phone it sits above the cube and scrolls inside its own box, so what you act
// on comes first and the longer reading folds away.

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
  'sticker inline-flex min-h-10 items-center rounded-lg bg-raised px-4 text-sm font-semibold text-fg transition-[transform,background-color] duration-200 ease-click hover:bg-[#2a2d34] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:min-h-11'
const NAV = 'inline-flex min-h-10 items-center text-sm text-fg-faint hover:text-fg pointer-coarse:min-h-11'
const LABEL = 'text-sm font-semibold text-fg'
const ORANGE = '#ff8a00'
const UNSET = '#2a2c33'

/** A fold-away part of the column. */
function More({ title, open, children, testId }: { title: string; open: boolean; children: React.ReactNode; testId?: string }) {
  return (
    <details open={open} data-testid={testId} className="academy-more mt-6 border-t border-white/[0.07] pt-1">
      <summary className="flex min-h-10 items-center justify-between gap-3 rounded-md text-sm font-semibold text-fg pointer-coarse:min-h-11">
        {title}
        <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" className="academy-chevron shrink-0 text-fg-faint">
          <path d="m4.5 2.5 3.5 3.5-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="pb-1">{children}</div>
    </details>
  )
}

export function LessonPanel({ lesson, index, caseNumber, done, note, guiding, watching, progress, signMoves, onWatch, onGuide, onSelectCase }: Props) {
  const completed = useAcademyStore((s) => s.completed)
  const hasPractice = lesson.cases.length > 0
  const prev = LESSONS[index - 1]
  const next = LESSONS[index + 1]
  // Wide screens have room to show everything; a phone starts with the reading folded.
  const [wide] = useState(() => window.matchMedia('(min-width: 48rem)').matches)

  // Progress as it was before this lesson, so /learn can turn the new sticker over.
  useEffect(() => rememberProgress(useAcademyStore.getState().completed), [])

  // One sticker per piece the goal counts, turning over as each one lands.
  const placed = done ? progress.total : progress.done
  const stickers = useMemo(() => Array.from({ length: progress.total }, (_, i) => (i < placed ? ORANGE : UNSET)), [placed, progress.total])

  // On a phone the panel is short and scrolls by itself: bring a new
  // "complete" message or wrong-move note into view inside it.
  const alertRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!done && !note) return
    alertRef.current?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [done, note])

  const algs = lesson.algorithm ? [lesson.algorithm, ...(lesson.algorithm.mirror ? [lesson.algorithm.mirror] : [])] : []

  return (
    <aside
      data-testid="lesson-panel"
      className="flex max-h-[46%] shrink-0 flex-col overflow-y-auto overscroll-contain border-b border-white/[0.07] bg-panel px-4 pb-4 pt-2 sm:px-5 md:max-h-none md:w-96 md:border-b-0 md:border-r md:pb-5 md:pt-4"
    >
      <div className="flex items-center gap-3">
        <p className="shrink-0 text-sm font-semibold text-sticker-orange">
          Lesson {index + 1} of {LESSONS.length}
        </p>
        {/* On a phone eight stickers are too narrow to tap; they only show where you are, and Back / Skip move between lessons. */}
        <div aria-hidden className="flex flex-1 items-center gap-1 sm:hidden">
          {LESSONS.map((l, i) => (
            <span key={l.id} className={`h-2 flex-1 rounded-[3px] ${i === index ? 'bg-fg' : completed.includes(l.id) ? 'bg-sticker-orange' : 'bg-white/15'}`} />
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
                className={`h-2 w-full rounded-[3px] transition-colors ${
                  i === index ? 'bg-fg' : completed.includes(l.id) ? 'bg-sticker-orange' : 'bg-white/15 group-hover:bg-white/35'
                }`}
              />
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h1 className="font-display text-xl font-bold leading-tight md:text-2xl">{lesson.title}</h1>
        {lesson.goal && <PrimerButton />}
      </div>

      {/* What you are making, and how far the cube on screen has got. */}
      <section className="mt-2.5 flex gap-3 rounded-xl bg-ink p-3 md:mt-4" aria-label="Goal">
        <div aria-hidden className="grid size-14 shrink-0 place-items-center md:size-18">
          <GoalCube lessonId={lesson.id} cubie={wide ? 15 : 12} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug text-fg">
            <span className="text-fg-faint">{lesson.goal ? 'You are making: ' : 'Try this: '}</span>
            {lesson.goalText}
          </p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={placed}
            aria-label={progress.unit}
            className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1"
          >
            <StickerGrid colours={stickers} cols={progress.total} sticker={11} gap={2} round={0.22} from="first" each={0} duration={420} />
            <p data-testid="lesson-progress" className="text-sm tabular-nums text-fg-muted">
              {progress.done} of {progress.total} {progress.unit}
            </p>
          </div>
        </div>
      </section>

      <div ref={alertRef} className="scroll-my-3">
        {done && (
          <div data-testid="lesson-done" className="mt-3 rounded-xl bg-sticker-orange/10 p-4 ring-1 ring-inset ring-sticker-orange/45" role="status">
            <p className="font-display text-lg font-bold text-fg">{next ? 'Lesson complete' : 'You solved the cube'}</p>
            <p className="mt-0.5 text-sm text-fg-muted">
              {!next ? 'You have learned the whole method. Now solve one from a real scramble.' : hasPractice ? 'Try another practice position, or move on when you are ready.' : 'Move on when you are ready.'}
            </p>
            <Link
              to={next ? `/learn/${next.id}` : '/play/cube3'}
              data-testid={next ? 'next-lesson' : undefined}
              className="sticker mt-3 inline-flex min-h-10 items-center rounded-lg bg-sticker-yellow px-4 text-sm font-semibold text-plastic transition-transform duration-200 ease-click hover:bg-[#ffe04d] active:translate-y-px pointer-coarse:min-h-11"
            >
              {next ? `Next: ${next.title}` : 'Solve a scrambled cube'}
            </Link>
          </div>
        )}

        {note && (
          <p data-testid="lesson-note" role="status" className="mt-3 rounded-lg bg-[#F5B83D]/10 px-3 py-2 text-sm text-[#F5B83D]">
            {note}
          </p>
        )}
      </div>

      {/* Wave 2: the guided-step card ("Now: bring the white-red edge down", from
          src/core/academy/teach) goes here, between the goal and the practice controls. */}

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
                  className={`font-display h-9 w-9 rounded-lg font-bold transition-[transform,background-color] duration-200 ease-click active:translate-y-px pointer-coarse:h-11 pointer-coarse:w-11 ${
                    caseNumber === i + 1 ? 'sticker bg-sticker-orange text-plastic' : 'bg-raised text-fg hover:bg-[#2a2d34]'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-sm text-fg-faint">Solve it on the big cube yourself, or get help:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" data-testid="watch-it" className={ACTION} onClick={onWatch} disabled={guiding || done} title="Plays the whole solution for you to watch">
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

      <section className="mt-6" aria-labelledby="how-label">
        <h2 id="how-label" className={LABEL}>
          How to do it
        </h2>
        {index > 0 && <p className="mt-1 text-sm text-fg-faint">Hold the cube with white on the bottom and yellow on top.</p>}
        <ol className="mt-3 space-y-3 text-[15px] leading-relaxed text-fg-muted">
          {lesson.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span aria-hidden className="sticker mt-1 grid size-5 shrink-0 place-items-center rounded-sm bg-raised font-display text-xs font-bold text-fg">
                {i + 1}
              </span>
              <span>
                <MoveText text={step} />
              </span>
            </li>
          ))}
        </ol>
        {lesson.goal && <TopFacePictures lessonId={lesson.id} />}
        {hasPractice && <p className="mt-3 text-sm text-fg-faint">The practice positions are already held the right way round, so you will not need to turn the whole cube.</p>}
      </section>

      {lesson.stuck && (
        <More title="If you are stuck" open={false}>
          <ul className="mt-2 space-y-3">
            {lesson.stuck.map((s) => (
              <li key={s.when} className="rounded-lg bg-ink p-3 text-sm leading-relaxed">
                <p className="font-semibold text-fg">{s.when}</p>
                <p className="mt-1 text-fg-muted">
                  <MoveText text={s.then} />
                </p>
              </li>
            ))}
          </ul>
        </More>
      )}

      {lesson.algorithm && <MovesDemo key={lesson.id} lessonId={lesson.id} algs={algs} hint={lesson.algorithm.hint} />}

      {!lesson.goal && (
        <section className="mt-6" aria-labelledby="letters-label">
          <h2 id="letters-label" className={`${LABEL} mb-3`}>
            The letters
          </h2>
          <NotationPrimer />
        </section>
      )}

      {signMoves && (
        <More title="With your hands" open={wide} testId="lesson-signs">
          <p className="mt-1 text-sm text-fg-faint">
            The <b style={{ color: HAND_COLOR.Right }}>right hand</b> turns clockwise, the <b style={{ color: HAND_COLOR.Left }}>left hand</b> counter-clockwise. Raise
            the lit fingers and hold.
          </p>
          <div className="mt-2">
            <SignSequence moves={signMoves} />
          </div>
        </More>
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
