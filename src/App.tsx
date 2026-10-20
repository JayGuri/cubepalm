import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, Navigate, Route, BrowserRouter as Router, Routes, useLocation, useParams } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Home } from './components/screens/Home'
import { SiteNav } from './components/SiteNav'
import { lessonById } from './core/academy/lessons'
import { isPuzzleAvailable } from './core/puzzles/registry'
import { applyPageMeta, pageMeta } from './pageMeta'
import type { SolverStatus } from './core/solvers/kociemba'

// The play screen pulls in three.js, the puzzle engine and MediaPipe glue
// (~1.5 MB); the home page needs none of it, so each screen loads on demand.
const FreePlay = lazy(() => import('./components/screens/FreePlay').then((m) => ({ default: m.FreePlay })))
const Academy = lazy(() => import('./components/screens/Academy').then((m) => ({ default: m.Academy })))
const Stats = lazy(() => import('./components/screens/Stats').then((m) => ({ default: m.Stats })))
const Recorder = lazy(() => import('./components/screens/Recorder').then((m) => ({ default: m.Recorder })))
const Settings = lazy(() => import('./components/screens/Settings').then((m) => ({ default: m.Settings })))

// Keyed by puzzle so switching cubes starts a fresh session (counters, timer, best).
function PlayRoute() {
  const { puzzleId = 'cube3' } = useParams<{ puzzleId: string }>()
  return isPuzzleAvailable(puzzleId) ? <FreePlay key={puzzleId} /> : <NotFound />
}

function LessonRoute() {
  const { lessonId = '' } = useParams<{ lessonId: string }>()
  return lessonById(lessonId) ? <FreePlay key={lessonId} lessonId={lessonId} /> : <Navigate to="/learn" replace />
}

// An address that leads nowhere: say so, show what was asked for, and offer the
// main ways in rather than silently landing on the home page.
function NotFound() {
  const { pathname } = useLocation()
  return (
    <main className="min-h-dvh bg-[#16171B] px-4 py-8 text-[#ECEAE4] sm:px-6 sm:py-12" data-testid="not-found">
      <div className="mx-auto max-w-2xl">
        <SiteNav size={40} />
        <h1 className="font-display mt-12 text-3xl font-extrabold tracking-tight sm:text-4xl">There is no page here</h1>
        <p className="mt-3 text-[#B2B0B9]">
          Nothing on CubePalm lives at <code className="rounded bg-[#202227] px-1.5 py-0.5 text-sm [overflow-wrap:anywhere] text-[#ECEAE4]">{pathname}</code>. The link
          may be old or mistyped.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/" className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#FFD500] px-6 font-semibold text-[#16171B] hover:bg-[#FFE04D]">
            Go to the home page
          </Link>
          <Link to="/play/cube3" className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 px-6 font-semibold hover:border-white/50">
            Play the 3×3
          </Link>
          <Link to="/learn" className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 px-6 font-semibold hover:border-white/50">
            Learn to solve it
          </Link>
        </div>
      </div>
    </main>
  )
}

// Keeps the tab title, description and canonical address in step with the page.
function PageMeta() {
  const { pathname } = useLocation()
  useEffect(() => applyPageMeta(pageMeta(pathname)), [pathname])
  return null
}

function App() {
  // The solver's tables are built once at startup, in a worker, rather than on
  // the first Solve press. Its state is owned by the solver itself (kociemba.ts);
  // a failure is not fatal -- everything except Solve and Guide still works --
  // and the play screen offers a retry.
  const [solver, setSolver] = useState<SolverStatus>('idle')
  useEffect(() => {
    let unsubscribe = () => {}
    let cancelled = false
    // Loaded on demand so the solver stays out of the home page's bundle.
    const warmUp = () => {
      void import('./core/solvers/kociemba').then((m) => {
        if (cancelled) return
        unsubscribe = m.subscribeSolverStatus(() => setSolver(m.getSolverStatus()))
        m.initSolver().catch(() => undefined)
      })
    }
    // Neither the warm-up nor the play screen's code is wanted by the page being
    // opened, unless that page is a cube: on any other page they would only compete
    // with it for the network and the main thread, so they wait for the browser to
    // be idle. A cube screen needs the solver at once.
    const idle = (run: () => void) => (window.requestIdleCallback ? window.requestIdleCallback(run, { timeout: 4000 }) : window.setTimeout(run, 1500))
    const onCube = /^\/(play|learn\/)/.test(window.location.pathname)
    if (onCube) warmUp()
    else idle(warmUp)
    // Fetch the play screen's code while the visitor is still reading the home
    // page, so the first click on Play opens at once. Skipped for anyone who has
    // asked their browser to save data.
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    if (!saveData) idle(() => void import('./components/screens/FreePlay').catch(() => undefined))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])
  const solverReady = solver === 'ready' || solver === 'fallback'

  return (
    <Router>
      <PageMeta />
      <div data-testid="app" data-solver-ready={solverReady ? 'true' : 'false'} data-solver-state={solver}>
        <ErrorBoundary>
        <Suspense fallback={<div className="min-h-dvh bg-[#16171B]" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play/:puzzleId" element={<PlayRoute />} />
          <Route path="/learn" element={<Academy />} />
          <Route path="/learn/:lessonId" element={<LessonRoute />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/record" element={<Recorder />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </div>
    </Router>
  )
}

export default App
