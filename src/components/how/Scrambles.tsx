import { useCallback, useState } from 'react'
import { chiSquare, useNearScreen, useWidth } from './howMath'
import type { HowResponse } from './how.worker'
import { useHowWorker } from './useHowWorker'
import { BUTTON, Key, Section, TableView } from './ui'

const TOTAL = 60_000
// docs/research/scrambles.md: 600,000 states, corner-in-slot-0, 99.9% critical value for 7 d.f.
const STUDY = { n: 600_000, chiSquare: 6.863, critical: 24.322, lowest: 74492, highest: 75347, expected: 75000 }

function BarChart({ counts, width, expected, label }: { counts: number[]; width: number; expected: number; label: string }) {
  const height = 160
  const pad = { l: 36, r: 8, t: 10, b: 20 }
  const w = width - pad.l - pad.r
  const h = height - pad.t - pad.b
  const max = Math.max(expected * 1.3, ...counts, 1) // never 0: nothing drawn yet would make the scale 0 / 0
  const bw = w / counts.length
  const y = (v: number) => pad.t + (1 - v / max) * h
  return (
    <svg width={width} height={height} className="block" role="img" aria-label={label}>
      <line x1={pad.l} x2={width - pad.r} y1={y(expected)} y2={y(expected)} className="how-threshold" />
      {counts.map((c, i) => (
        <rect key={i} x={pad.l + i * bw + 1} y={y(c)} width={Math.max(1, bw - 2)} height={height - pad.b - y(c)} rx="2" className="fill-sticker-red/75" />
      ))}
      <text x={pad.l - 6} y={y(expected) + 4} textAnchor="end" className="how-tick">
        even
      </text>
      {[0, counts.length - 1].map((i) => (
        <text key={i} x={pad.l + i * bw + bw / 2} y={height - 4} textAnchor="middle" className="how-tick">
          {i}
        </text>
      ))}
    </svg>
  )
}

export function Scrambles() {
  const [containerRef, near] = useNearScreen<HTMLDivElement>()
  const [chartRef, width] = useWidth<HTMLDivElement>(420)
  const [n, setN] = useState(0)
  const [counts, setCounts] = useState<number[]>(new Array(8).fill(0))
  const [running, setRunning] = useState(false)

  const onMessage = useCallback((r: HowResponse) => {
    if (r.type !== 'counts') return
    setN(r.n)
    setCounts(r.counts[0])
    if (r.n >= TOTAL) setRunning(false)
  }, [])
  const send = useHowWorker(near, onMessage)

  const run = () => {
    setRunning(true)
    setN(0)
    setCounts(new Array(8).fill(0))
    send({ type: 'sample', id: Date.now(), total: TOTAL })
  }

  const chi = chiSquare(counts)
  const expected = n / 8

  return (
    <Section
      id="scrambles"
      title="Fair scrambles"
      lead={
        <p>
          A scramble is a uniformly random reachable cube, solved and played backwards: pick a random corner arrangement and a random edge arrangement of matching parity,
          random twists summing to a multiple of 3 and random flips summing to a multiple of 2, and every one of the 43 quintillion positions comes out equally likely.
        </p>
      }
    >
      <div ref={containerRef} className="how-panel plastic mt-6 grid gap-6 rounded-2xl p-4 sm:p-6 md:grid-cols-2">
        <div className="min-w-0">
          <h3 className="font-bold">Draw {TOTAL.toLocaleString()} states, here, now</h3>
          <p className="mt-1 text-sm text-fg-muted">Which corner sits in one fixed slot (8 equally likely pieces), counted as the draws come in, in a worker.</p>
          <button type="button" className={`${BUTTON} mt-3`} onClick={run} disabled={!near || running} data-testid="run-sample">
            {n === 0 ? 'Draw states' : running ? 'Drawing…' : 'Draw again'}
          </button>
          <div ref={chartRef} className="mt-4">
            <BarChart counts={counts} width={width} expected={expected} label={`Counts of each of 8 corners after ${n.toLocaleString()} draws, expected ${Math.round(expected)} each`} />
          </div>
          <p className="mt-2 text-sm text-fg-muted" aria-live="polite" data-testid="sample-status">
            {n > 0 ? `${n.toLocaleString()} drawn. Chi-square ${chi.toFixed(2)} against ${STUDY.critical} at 99.9% (7 degrees of freedom).` : 'Nothing drawn yet.'}
          </p>
          <TableView caption="Count of each corner in slot 0" head={['corner', 'count']} rows={counts.map((c, i) => [i, c])} />
        </div>
        <div className="min-w-0 border-t border-white/10 pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <h3 className="font-bold">The same test, at a scale a browser tab should not run</h3>
          <p className="mt-1 text-sm text-fg-muted">docs/research/scrambles.md drew 600,000 states (a fixed seed, so it is exactly reproducible) and ran nine such tests, including the two values the generator computes rather than draws.</p>
          <ul className="mt-3 grid gap-1.5 text-sm text-fg-muted">
            <li>
              Corner in slot 0, {STUDY.n.toLocaleString()} draws: counts from {STUDY.lowest.toLocaleString()} to {STUDY.highest.toLocaleString()}, expected {STUDY.expected.toLocaleString()} — chi-square{' '}
              <b className="text-fg">{STUDY.chiSquare}</b>, under the <b className="text-fg">{STUDY.critical}</b> bound.
            </li>
            <li>All nine tests, including the computed twist and flip, passed at the 99.9% level.</li>
            <li>Of 600,000 states, none broke a reachability rule.</li>
          </ul>
          <p className="mt-3 flex items-center gap-2 text-xs text-fg-faint">
            <Key kind="measured" /> docs/research/scrambles.md
          </p>
          <p className="mt-4 text-sm text-fg-muted">
            A real scramble is drawn with the browser&apos;s cryptographic generator, not the seeded one used for this test, and is solved and played backwards — about 22 face
            turns on average, never fewer than 16.
          </p>
        </div>
      </div>
    </Section>
  )
}
