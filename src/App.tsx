import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, BrowserRouter as Router, Routes, useParams } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Home } from './components/screens/Home'
import { lessonById } from './core/academy/lessons'
import type { SolverStatus } from './core/solvers/kociemba'

// The play screen pulls in three.js, the puzzle engine and MediaPipe glue
// (~1.5 MB); the home page needs none of it, so each screen loads on demand.
const FreePlay = lazy(() => import('./components/screens/FreePlay').then((m) => ({ default: m.FreePlay })))
const Academy = lazy(() => import('./components/screens/Academy').then((m) => ({ default: m.Academy })))
const Settings = lazy(() => import('./components/screens/Settings').then((m) => ({ default: m.Settings })))

// Keyed by puzzle so switching cubes starts a fresh session (counters, timer, best).
function PlayRoute() {
  const { puzzleId = 'cube3' } = useParams<{ puzzleId: string }>()
  return <FreePlay key={puzzleId} />
}

function LessonRoute() {
  const { lessonId = '' } = useParams<{ lessonId: string }>()
  return lessonById(lessonId) ? <FreePlay key={lessonId} lessonId={lessonId} /> : <Navigate to="/learn" replace />
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
    void import('./core/solvers/kociemba').then((m) => {
      if (cancelled) return
      unsubscribe = m.subscribeSolverStatus(() => setSolver(m.getSolverStatus()))
      m.initSolver().catch(() => undefined)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])
  const solverReady = solver === 'ready' || solver === 'fallback'

  return (
    <Router>
      <div data-testid="app" data-solver-ready={solverReady ? 'true' : 'false'} data-solver-state={solver}>
        <ErrorBoundary>
        <Suspense fallback={<div className="min-h-dvh bg-[#16171B]" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play/:puzzleId" element={<PlayRoute />} />
          <Route path="/learn" element={<Academy />} />
          <Route path="/learn/:lessonId" element={<LessonRoute />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </div>
    </Router>
  )
}

export default App
