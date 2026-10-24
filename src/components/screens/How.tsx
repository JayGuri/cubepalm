import { CubeNumbers } from '../how/CubeNumbers'
import { HandLab } from '../how/HandLab'
import { Scrambles } from '../how/Scrambles'
import { SolverChart } from '../how/SolverChart'
import { LINK } from '../how/ui'
import { SiteFooter } from '../shell/SiteFooter'
import { SiteNav } from '../SiteNav'
import '../../styles/how.css'

const GITHUB = 'https://github.com/JayGuri/cubepalm'

// How CubePalm works, shown rather than told. Every number here is either
// worked out on this page by the app's own code (src/core/gestures,
// src/core/solvers), or copied from docs/REPORT.md and docs/research/*.md,
// which a script in the repository produced and anyone can re-run. Nothing
// here is estimated.

export function How() {
  return (
    <main className="min-h-dvh overflow-x-clip bg-ink text-fg">
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-7">
        <SiteNav />

        <header className="mt-12 max-w-2xl sm:mt-16">
          <h1 className="font-display text-[clamp(2.4rem,6.5vw,3.6rem)] font-extrabold leading-[0.98] tracking-tight text-balance">How it works</h1>
          <p className="mt-4 text-lg leading-relaxed text-pretty text-fg-muted">
            This page covers why a cube has 43 quintillion positions, how a webcam turns a hand into a move, how the solver looks for a short route (and sometimes proves
            it is the shortest), and why a scramble is a fair draw. Every number below is either worked out here as you read, or quoted from a measured report.
          </p>
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <li>
              <a href="https://github.com/JayGuri/cubepalm/blob/main/docs/REPORT.md" target="_blank" rel="noreferrer" className={LINK}>
                Technical report
              </a>
            </li>
            <li>
              <a href="https://github.com/JayGuri/cubepalm/blob/main/docs/MATH.md" target="_blank" rel="noreferrer" className={LINK}>
                The maths, in full
              </a>
            </li>
            <li>
              <a href={GITHUB} target="_blank" rel="noreferrer" className={LINK}>
                Source on GitHub
              </a>
            </li>
          </ul>
        </header>

        <CubeNumbers />
        <HandLab />
        <SolverChart />
        <Scrambles />

        <section className="how-section border-t border-white/10 pt-10 text-center sm:pt-12">
          <h2 className="font-display text-2xl font-bold">Read the rest</h2>
          <p className="mx-auto mt-3 max-w-md text-fg-muted">
            The report says what was measured and how. MATH.md proves the search never loses a shorter route and that the scramble is exactly uniform. The source is
            the same code this page just ran.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-5 text-sm">
            <a href="https://github.com/JayGuri/cubepalm/blob/main/docs/REPORT.md" target="_blank" rel="noreferrer" className={LINK}>
              docs/REPORT.md
            </a>
            <a href="https://github.com/JayGuri/cubepalm/blob/main/docs/MATH.md" target="_blank" rel="noreferrer" className={LINK}>
              docs/MATH.md
            </a>
            <a href="https://github.com/JayGuri/cubepalm/tree/main/docs/research" target="_blank" rel="noreferrer" className={LINK}>
              docs/research/
            </a>
            <a href={GITHUB} target="_blank" rel="noreferrer" className={LINK}>
              GitHub
            </a>
          </div>
        </section>

        <SiteFooter />
      </div>
    </main>
  )
}
