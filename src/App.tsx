import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react'
import { Link, Navigate, Route, BrowserRouter as Router, Routes, useLocation, useParams } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Home } from './components/screens/Home'
import { SiteNav } from './components/SiteNav'
import { PageLoader, ScrambledFace } from './components/shell/Faces'
import { PageTurns } from './components/shell/PageTurns'
import { SiteFooter } from './components/shell/SiteFooter'
import { lessonById } from './core/academy/lessons'
import { isPuzzleAvailable } from './core/puzzles/registry'
import { applyPageMeta, pageMeta } from './pageMeta'
import type { SolverStatus } from './core/solvers/kociemba'

// A screen whose code is fetched on demand. `preload` fetches it ahead of time;
// once it is here the screen draws at once, without suspending, which is what
// lets a page turn capture the real page rather than a loading screen.
function lazyScreen<P extends object>(load: () => Promise<ComponentType<P>>) {
  let loaded: ComponentType<P> | undefined
  const preload = () => load().then((c) => (loaded = c))
  const Lazy = lazy(() => preload().then((c) => ({ default: c })))
  function Screen(props: P) {
    // Chosen once per mount: switching type later would throw the screen's state away.
    const [C] = useState(() => loaded ?? Lazy)
    return <C {...props} />
  }
  return Object.assign(Screen, { preload })
}

// The play screen pulls in three.js, the puzzle engine and MediaPipe glue
// (~1.5 MB); the home page needs none of it, so each screen loads on demand.
const FreePlay = lazyScreen<{ lessonId?: string }>(() => import('./components/screens/FreePlay').then((m) => m.FreePlay))
const Academy = lazyScreen(() => import('./components/screens/Academy').then((m) => m.Academy))
const Stats = lazyScreen(() => import('./components/screens/Stats').then((m) => m.Stats))
const Recorder = lazyScreen(() => import('./components/screens/Recorder').then((m) => m.Recorder))
const Settings = lazyScreen(() => import('./components/screens/Settings').then((m) => m.Settings))
const How = lazyScreen(() => import('./components/screens/How').then((m) => m.How))

/** The code a path's page needs, fetched now. */
function preloadPage(path: string) {
  if (/^\/(play|learn)\/./.test(path)) return FreePlay.preload()
  const screen = { '/learn': Academy, '/stats': Stats, '/record': Recorder, '/settings': Settings, '/how': How }[path.replace(/\/+$/, '')]
  return screen?.preload()
}

// Keyed by puzzle so switching cubes starts a fresh session (counters, timer, best).
function PlayRoute() {
  const { puzzleId = 'cube3' } = useParams<{ puzzleId: string }>()
  return isPuzzleAvailable(puzzleId) ? <FreePlay key={puzzleId} /> : <NotFound />
}

function LessonRoute() {
  const { lessonId = '' } = useParams<{ lessonId: string }>()
  return lessonById(lessonId) ? <FreePlay key={lessonId} lessonId={lessonId} /> : <Navigate to="/learn" replace />
}

const BUTTON = 'inline-flex min-h-11 items-center justify-center rounded-xl px-6 font-semibold transition-[translate,background-color,border-color] duration-200 ease-click active:translate-y-px'

// An address that leads nowhere: a face that came apart, what happened in plain
// words, and the ways back in, rather than silently landing on the home page.
function NotFound() {
  const { pathname } = useLocation()
  return (
    <main className="min-h-dvh bg-ink px-4 py-8 text-fg sm:px-6 sm:py-12" data-testid="not-found">
      <div className="mx-auto max-w-3xl">
        <SiteNav size={40} />
        <div className="mt-14 flex flex-col gap-8 sm:mt-20 sm:flex-row sm:items-center sm:gap-12">
          <ScrambledFace />
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">There is no page here</h1>
            <p className="mt-3 max-w-md text-fg-muted">
              Nothing on CubePalm lives at <code className="rounded bg-raised px-1.5 py-0.5 text-sm wrap-anywhere text-fg">{pathname}</code>. The link may be old or
              mistyped.
            </p>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link to="/" className={`${BUTTON} sticker bg-sticker-yellow text-plastic hover:bg-[#ffe04d]`}>
            Go to the home page
          </Link>
          <Link to="/play/cube3" className={`${BUTTON} border border-white/15 hover:border-white/40`}>
            Play the 3×3
          </Link>
          <Link to="/learn" className={`${BUTTON} border border-white/15 hover:border-white/40`}>
            Learn to solve it
          </Link>
        </div>
        <SiteFooter />
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
    if (!saveData) idle(() => void FreePlay.preload().catch(() => undefined))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])
  const solverReady = solver === 'ready' || solver === 'fallback'

  return (
    <Router>
      <PageMeta />
      <PageTurns preload={preloadPage} />
      <div data-testid="app" data-solver-ready={solverReady ? 'true' : 'false'} data-solver-state={solver}>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/play/:puzzleId" element={<PlayRoute />} />
              <Route path="/learn" element={<Academy />} />
              <Route path="/learn/:lessonId" element={<LessonRoute />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/record" element={<Recorder />} />
              <Route path="/how" element={<How />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
    </Router>
  )
}

export default App
