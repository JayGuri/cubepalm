import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { clearUsage, currentUsage, flushUsage, METHOD_NAME, summariseUsage, type MethodSummary } from '../../state/usageLog'
import { StickerGrid } from '../cube/StickerGrid'
import { MethodBars, type Bar } from '../pages/MethodBars'
import { PageFrame } from '../pages/PageFrame'
import { scrambled } from '../pages/scramble'
import { formatTime } from './play/useSolveSession'

// How the input methods compare on this device: pace, mistakes with the guide
// up, and solve times. The numbers come from the usage log, which never leaves
// the browser unless the player downloads it.

const dash = '–'

// Each figure as text; a dash where there are too few turns to say.
const pace = (m: MethodSummary) => (m.medianGapMs === null ? dash : `${(m.medianGapMs / 1000).toFixed(2)} s (${Math.round(m.turnsPerMinute!)} a minute)`)
const offGuide = (m: MethodSummary) => (m.offTrackRate === null ? dash : `${(m.offTrackRate * 100).toFixed(1)}% of ${m.guided}`)
const solves = (m: MethodSummary) => (m.solves === 0 ? dash : `${m.solves}, median ${formatTime(m.medianSolveMs!)}`)

/** A plain sentence for what a chart shows: who leads, once there are two to compare. */
function takeaway(bars: Bar[], better: 'more' | 'less', lead: (name: string) => string, otherwise: string): string {
  const known = bars.filter((b): b is Bar & { value: number } => b.value !== null)
  if (known.length < 2) return otherwise
  const best = known.reduce((a, b) => ((better === 'more' ? b.value > a.value : b.value < a.value) ? b : a))
  return lead(best.name)
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  link.click()
  URL.revokeObjectURL(url)
}

const EMPTY_FACE = scrambled(9, [], 4)

export function Stats() {
  // Read once per visit (and again after clearing): the log does not change while this screen is open.
  const [events, setEvents] = useState(() => [...currentUsage()])
  const summary = useMemo(() => summariseUsage(events), [events])
  const used = summary.methods.filter((m) => m.turns > 0)
  const paceBars: Bar[] = used.map((m) => ({ name: METHOD_NAME[m.method], value: m.turnsPerMinute, text: m.turnsPerMinute === null ? '' : String(Math.round(m.turnsPerMinute)) }))
  const offBars: Bar[] = used.map((m) => ({ name: METHOD_NAME[m.method], value: m.offTrackRate === null ? null : m.offTrackRate * 100, text: m.offTrackRate === null ? '' : `${(m.offTrackRate * 100).toFixed(1)}%` }))

  return (
    <PageFrame wide>
      <h1 className="font-display mt-10 text-3xl font-extrabold tracking-tight sm:mt-12 sm:text-4xl">How you turn the cube</h1>
      <p className="mt-3 max-w-xl text-fg-muted">
        Every turn you make is noted with the method that made it, on this device only. Nothing is sent anywhere. With enough turns this
        shows which way of turning is quickest for you and which goes wrong least.
      </p>

      {used.length === 0 ? (
        <div className="plastic mt-10 flex flex-col gap-6 rounded-2xl p-6 sm:flex-row sm:items-center sm:gap-8 sm:p-8" data-testid="stats-empty">
          <StickerGrid colours={EMPTY_FACE} sticker={22} gap={4} className="shrink-0 self-start sm:self-center" />
          <div>
            <h2 className="font-display text-xl font-bold">Nothing recorded yet</h2>
            <p className="mt-2 max-w-md text-fg-muted">
              Scramble a cube and turn it by dragging, with the keyboard, the turn buttons or hand signs, then come back. Six turns in a row
              with one method are enough to show its pace.
            </p>
            <Link to="/play/cube3" className="pg-btn pg-btn-go mt-5">
              Make your first turn
            </Link>
          </div>
        </div>
      ) : (
        <>
          <section aria-label="At a glance" className="mt-10 grid gap-3 sm:grid-cols-2">
            <MethodBars
              title="Turns a minute"
              better="more"
              bars={paceBars}
              takeaway={takeaway(paceBars, 'more', (n) => `${n} is your quickest so far.`, 'More is quicker. Six turns in a row with one method show its pace.')}
            />
            <MethodBars
              title="Off the guide"
              better="less"
              bars={offBars}
              takeaway={takeaway(offBars, 'less', (n) => `${n} strays from the guide least so far.`, 'Fewer is better. Counted while Guide me is showing.')}
            />
          </section>

          <h2 className="font-display mt-12 text-xl font-bold">The exact figures</h2>
          {/* Phone: one block per method, each figure on its own line. */}
          <ul className="mt-4 space-y-3 sm:hidden" data-testid="stats-list">
            {used.map((m) => (
              <li key={m.method} className="plastic rounded-2xl p-4">
                <p className="font-display text-lg font-bold">{METHOD_NAME[m.method]}</p>
                <dl className="pg-seams mt-2 text-sm tabular-nums">
                  {[
                    ['Turns', String(m.turns)],
                    ['Pace', pace(m)],
                    ['Off the guide', offGuide(m)],
                    ['Solves', solves(m)],
                  ].map(([term, value]) => (
                    <div key={term} className="flex justify-between gap-4 py-2">
                      <dt className="text-fg-faint">{term}</dt>
                      <dd className="text-right">{value}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
          <div className="plastic mt-4 overflow-x-auto rounded-2xl max-sm:hidden">
            <table className="w-full text-left text-sm" data-testid="stats-table">
              <thead className="text-fg-faint">
                <tr>
                  <th scope="col" className="px-5 py-3 font-normal">Method</th>
                  <th scope="col" className="px-4 py-3 text-right font-normal">Turns</th>
                  <th scope="col" className="px-4 py-3 text-right font-normal">Pace</th>
                  <th scope="col" className="px-4 py-3 text-right font-normal">Off the guide</th>
                  <th scope="col" className="px-5 py-3 text-right font-normal">Solves</th>
                </tr>
              </thead>
              <tbody className="pg-seams tabular-nums">
                {used.map((m) => (
                  <tr key={m.method} data-testid={`stats-${m.method}`}>
                    <th scope="row" className="px-5 py-3 font-bold">{METHOD_NAME[m.method]}</th>
                    <td className="px-4 py-3 text-right">{m.turns}</td>
                    <td className="px-4 py-3 text-right">{pace(m)}</td>
                    <td className="px-4 py-3 text-right">{offGuide(m)}</td>
                    <td className="px-5 py-3 text-right">{solves(m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-sm text-fg-faint">
            {summary.turns} {summary.turns === 1 ? 'turn' : 'turns'} and {summary.undos} {summary.undos === 1 ? 'undo' : 'undos'} recorded. A dash means too few turns to say (fewer than five).
          </p>

          {/* What each figure means, written out: a hover title cannot be read on a touch screen. */}
          <dl className="mt-8 space-y-3 text-sm">
            {[
              ['Pace', 'Median time between two turns, leaving out pauses of more than eight seconds.'],
              ['Off the guide', 'With the guide showing, how many turns were not the one it asked for.'],
              ['Solves', 'Random scrambles solved without the guide or Solve for me, and their median time.'],
            ].map(([term, meaning]) => (
              <div key={term} className="sm:grid sm:grid-cols-[8rem_1fr] sm:gap-4">
                <dt className="font-bold">{term}</dt>
                <dd className="text-fg-faint">{meaning}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {events.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-3">
          <button
            type="button"
            data-testid="stats-download"
            className="pg-btn pg-btn-go"
            onClick={() => {
              flushUsage()
              download('cubepalm-usage.json', JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), events }, null, 1))
            }}
          >
            Download as a file
          </button>
          <button
            type="button"
            data-testid="stats-clear"
            className="pg-btn pg-btn-danger"
            onClick={() => {
              if (!window.confirm('Clear everything recorded about how you turn the cube? This cannot be undone.')) return
              clearUsage()
              setEvents([])
            }}
          >
            Clear
          </button>
        </div>
      )}
    </PageFrame>
  )
}
