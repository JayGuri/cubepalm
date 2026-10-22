import { useCallback, useRef, useState } from 'react'
import type { HowResponse } from './how.worker'
import { ms, useNearScreen, useWidth } from './howMath'
import { useHowWorker } from './useHowWorker'
import { BUTTON, Key, Section, TableView } from './ui'

// docs/research/solver.md, "How often a route is proven shortest": 20 positions
// made by k random face turns from solved, for each k from 2 to 14.
const PROVEN = { k: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], of: 20, proven: [20, 20, 20, 20, 20, 20, 20, 19, 17, 13, 10, 8, 4] }
// docs/research/solver.md, "Route cost in quarter turns": 50 uniformly random cubes.
const BUDGETS = { label: ['first', '0.1 s', '0.5 s', '2 s', '5 s'], mean: [32.22, 28.62, 26.1, 25.02, 24.7] }

interface Point {
  t: number
  cost: number
  view: number
}

type Phase = 'idle' | 'running' | 'done'

function Point_({ cx, cy, r = 4 }: { cx: number; cy: number; r?: number }) {
  return <circle cx={cx} cy={cy} r={r} className="how-dot-live" />
}

function RouteChart({ points, proven, budgetMs, width }: { points: Point[]; proven: boolean; budgetMs: number; width: number }) {
  const height = 260
  const pad = { l: 44, r: 16, t: 16, b: 30 }
  const w = width - pad.l - pad.r
  const h = height - pad.t - pad.b
  const maxCost = Math.max(36, ...points.map((p) => p.cost), ...BUDGETS.mean)
  const minCost = Math.min(18, ...points.map((p) => p.cost))
  const x = (t: number) => pad.l + Math.min(1, t / budgetMs) * w
  const y = (c: number) => pad.t + ((c - minCost) / (maxCost - minCost)) * h
  const ticks = [20, 24, 28, 32, 36].filter((t) => t >= minCost - 2 && t <= maxCost + 2)
  // A step line: the cheapest cost known so far, at any time.
  const steps = points.reduce<Point[]>((out, p) => (out.length && p.cost >= out[out.length - 1].cost ? out : [...out, p]), [])
  const path = steps.length
    ? steps.reduce((d, p, i) => (i === 0 ? `M${x(0)},${y(p.cost)} L${x(p.t)},${y(p.cost)}` : `${d} L${x(p.t)},${y(steps[i - 1].cost)} L${x(p.t)},${y(p.cost)}`), '') +
      ` L${x(budgetMs)},${y(steps[steps.length - 1].cost)}`
    : ''
  return (
    <svg
      width={width}
      height={height}
      className="block"
      role="img"
      aria-label={
        steps.length
          ? `Route cost over time: starts at ${steps[0].cost} quarter turns, now ${steps[steps.length - 1].cost}${proven ? ', proven the shortest possible' : ''}.`
          : 'Waiting for the search to find a first route.'
      }
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="how-grid" />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="how-tick">
            {t}
          </text>
        </g>
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <text key={f} x={pad.l + f * w} y={height - 8} textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'} className="how-tick">
          {ms(f * budgetMs)}
        </text>
      ))}
      {path && <path d={path} className="how-line-live" fill="none" />}
      {points.map((p, i) => (
        <Point_ key={i} cx={x(p.t)} cy={y(p.cost)} r={3} />
      ))}
      {steps.length > 0 && <Point_ cx={x(Math.min(budgetMs, steps[steps.length - 1].t))} cy={y(steps[steps.length - 1].cost)} r={5} />}
    </svg>
  )
}

function ProofChart({ view }: { view: 'full' | 'near' }) {
  const width = 360
  const cell = 11
  const rows = PROVEN.k
  return (
    <svg width={width} height={rows.length * cell} viewBox={`0 0 ${width} ${rows.length * cell}`} className="max-w-full" role="img" aria-label={`Of 20 positions at each depth, the number proven the shortest possible: ${rows.map((k, i) => `${PROVEN.proven[i]} at ${k} turns`).join(', ')}.`}>
      {rows.map((k, i) => (
        <g key={k}>
          <text x="22" y={i * cell + 8.5} textAnchor="end" fontSize="9" className="fill-fg-faint tabular-nums">
            {k}
          </text>
          <rect x="28" y={i * cell} width={PROVEN.proven[i] * ((width - 28) / PROVEN.of)} height={cell - 1.5} rx="2" className={view === 'near' && i <= 6 ? 'fill-sticker-green' : 'fill-sticker-green/70'} />
          <rect x={28 + PROVEN.proven[i] * ((width - 28) / PROVEN.of)} y={i * cell} width={(PROVEN.of - PROVEN.proven[i]) * ((width - 28) / PROVEN.of)} height={cell - 1.5} rx="2" className="fill-white/5" />
        </g>
      ))}
    </svg>
  )
}

export function SolverChart() {
  const [containerRef, near] = useNearScreen<HTMLDivElement>()
  const [chartRef, width] = useWidth<HTMLDivElement>(560)
  const [phase, setPhase] = useState<Phase>('idle')
  const [scramble, setScramble] = useState('')
  const [points, setPoints] = useState<Point[]>([])
  const [proven, setProven] = useState(false)
  const [tablesMs, setTablesMs] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [nearSolved, setNearSolved] = useState<{ turns: number; cost: number; ms: number; proven: boolean } | null>(null)
  const idRef = useRef(0)
  const BUDGET_MS = 6000

  const onMessage = useCallback((r: HowResponse) => {
    if (r.type === 'tables') setTablesMs(r.ms)
    else if (r.type === 'scramble') setScramble(r.scramble)
    else if (r.type === 'route') setPoints((p) => [...p, { t: r.t, cost: r.cost, view: r.view }])
    else if (r.type === 'done') {
      setPhase('done')
      setProven(r.proven)
      setElapsed(r.t)
    } else if (r.type === 'proved') setNearSolved({ turns: scramble.split(' ').length, cost: r.cost, ms: r.ms, proven: r.cost === r.noneBelow })
  }, [scramble])

  const send = useHowWorker(near, onMessage)

  const run = () => {
    setPhase('running')
    setPoints([])
    setProven(false)
    setScramble('')
    idRef.current += 1
    send({ type: 'search', id: idRef.current, budgetMs: BUDGET_MS })
  }
  const proveNear = (turns: number) => {
    idRef.current += 1
    setNearSolved(null)
    send({ type: 'prove', id: idRef.current, turns })
  }

  const best = points.length ? Math.min(...points.map((p) => p.cost)) : null

  return (
    <Section
      id="solver"
      title="Finding a route"
      lead={
        <p>
          The solver splits the problem in two (phase 1 reaches a simpler family of positions; phase 2 finishes from there), searches six points of view at once, and only ever
          accepts a cheaper route. Run it for real, in a worker, on a fresh random scramble.
        </p>
      }
    >
      <div ref={containerRef} className="how-panel plastic mt-6 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={BUTTON} onClick={run} disabled={!near || phase === 'running'} data-testid="run-solver">
            {phase === 'idle' ? 'Scramble and search' : 'Search again'}
          </button>
          {tablesMs !== null && (
            <span className="text-sm text-fg-faint">
              Tables built in {ms(tablesMs)} <Key kind="live" />
            </span>
          )}
        </div>
        {scramble && (
          <p className="mt-3 wrap-break-word text-sm text-fg-muted" data-testid="solver-scramble">
            Scramble: <span className="font-mono text-fg">{scramble}</span>
          </p>
        )}
        <div ref={chartRef} className="mt-4">
          {phase === 'idle' ? (
            <div className="flex h-65 items-center justify-center text-sm text-fg-faint">A chart of the route length over time will appear here.</div>
          ) : (
            <RouteChart points={points} proven={proven} budgetMs={BUDGET_MS} width={width} />
          )}
        </div>
        <p className="mt-2 text-sm text-fg-muted" aria-live="polite" data-testid="solver-status">
          {phase === 'running' && (best === null ? 'Searching for a first route…' : `${best} quarter turns so far, still searching…`)}
          {phase === 'done' && (proven ? `${best} quarter turns, proven the shortest possible, after ${ms(elapsed)}.` : `${best} quarter turns after ${ms(elapsed)}, not proven shortest within this budget.`)}
        </p>
        <TableView
          caption="Route length against search time, this run"
          head={['time', 'view', 'quarter turns']}
          rows={points.map((p) => [ms(p.t), p.view, p.cost])}
        />
        <div className="mt-6 grid gap-6 border-t border-white/10 pt-5 sm:grid-cols-2">
          <div>
            <h3 className="font-bold">Measured over 50 random cubes</h3>
            <p className="mt-1 text-sm text-fg-muted">Mean route cost at each time budget, one thread, in Node.</p>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {BUDGETS.label.map((l, i) => (
                <li key={l} className="tabular-nums text-fg-muted">
                  {l}: <b className="text-fg">{BUDGETS.mean[i]}</b>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex items-center gap-2 text-xs text-fg-faint">
              <Key kind="measured" /> docs/research/solver.md
            </p>
          </div>
          <div>
            <h3 className="font-bold">Proof of the shortest route</h3>
            <p className="mt-1 text-sm text-fg-muted">Of 20 positions at each depth, how many a second search proved optimal.</p>
            <ProofChart view="full" />
            <p className="mt-2 flex items-center gap-2 text-xs text-fg-faint">
              <Key kind="measured" /> docs/research/solver.md: all 20 up to 8 turns, none of 50 fully random cubes within 5 s.
            </p>
          </div>
        </div>
      </div>

      <div className="how-panel plastic mt-6 rounded-2xl p-4 sm:p-6">
        <h3 className="font-display text-xl font-bold">When &quot;shortest possible&quot; is said</h3>
        <p className="mt-2 max-w-2xl text-fg-muted">
          Close to solved, a second search can rule out every cheaper route. Try it on a cube a few turns from solved, exactly as the research script does.
        </p>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Turns from solved">
          {[4, 8, 12].map((t) => (
            <button key={t} type="button" className={BUTTON} onClick={() => proveNear(t)} disabled={!near} data-testid={`prove-${t}`}>
              {t} random turns
            </button>
          ))}
        </div>
        {nearSolved && (
          <p className="mt-3 text-sm text-fg-muted" aria-live="polite" data-testid="prove-status">
            {nearSolved.turns} turns in, solved in {nearSolved.cost} quarter turns, {nearSolved.proven ? 'proven the shortest possible' : 'not proven within this budget'}, in{' '}
            {ms(nearSolved.ms)}.
          </p>
        )}
      </div>
    </Section>
  )
}
