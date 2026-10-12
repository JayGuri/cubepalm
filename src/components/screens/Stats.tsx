import { useState } from 'react'
import { SiteNav } from '../SiteNav'
import { clearUsage, currentUsage, flushUsage, METHOD_NAME, summariseUsage, type MethodSummary } from '../../state/usageLog'
import { formatTime } from './play/useSolveSession'

// How the input methods compare on this device: pace, mistakes with the guide
// up, and solve times. The numbers come from the usage log, which never leaves
// the browser unless the player downloads it.

const dash = '–'

// Each figure as text; a dash where there are too few turns to say.
const pace = (m: MethodSummary) => (m.medianGapMs === null ? dash : `${(m.medianGapMs / 1000).toFixed(2)} s (${Math.round(m.turnsPerMinute!)} a minute)`)
const offGuide = (m: MethodSummary) => (m.offTrackRate === null ? dash : `${(m.offTrackRate * 100).toFixed(1)}% of ${m.guided}`)
const solves = (m: MethodSummary) => (m.solves === 0 ? dash : `${m.solves}, median ${formatTime(m.medianSolveMs!)}`)

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  link.click()
  URL.revokeObjectURL(url)
}

export function Stats() {
  // Read once per visit (and again after clearing): the log does not change while this screen is open.
  const [events, setEvents] = useState(() => [...currentUsage()])
  const summary = summariseUsage(events)
  const used = summary.methods.filter((m) => m.turns > 0)

  return (
    <main className="min-h-dvh bg-[#16171B] px-4 py-8 text-[#ECEAE4] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <SiteNav size={40} />
        <h1 className="font-display mt-8 text-3xl font-extrabold tracking-tight sm:mt-10 sm:text-4xl">How you turn the cube</h1>
        <p className="mt-3 max-w-xl text-[#9C9AA3]">
          Every turn you make is noted with the method that made it, on this device only. Nothing is sent anywhere. With enough turns
          this shows which way of turning is quickest for you and which goes wrong least.
        </p>

        {used.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-white/10 bg-[#202227] p-6 text-[#9C9AA3]" data-testid="stats-empty">
            Nothing recorded yet. Scramble a cube and turn it by dragging, with the keyboard, the turn buttons or hand signs, then
            come back.
          </p>
        ) : (
          <>
            {/* Phone: one block per method, each figure on its own line. */}
            <ul className="mt-10 space-y-3 sm:hidden" data-testid="stats-list">
              {used.map((m) => (
                <li key={m.method} className="rounded-2xl border border-white/10 bg-[#202227] p-4">
                  <p className="font-display text-lg font-bold">{METHOD_NAME[m.method]}</p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm tabular-nums">
                    <dt className="text-[#9C9AA3]">Turns</dt>
                    <dd className="text-right">{m.turns}</dd>
                    <dt className="text-[#9C9AA3]">Pace</dt>
                    <dd className="text-right">{pace(m)}</dd>
                    <dt className="text-[#9C9AA3]">Off the guide</dt>
                    <dd className="text-right">{offGuide(m)}</dd>
                    <dt className="text-[#9C9AA3]">Solves</dt>
                    <dd className="text-right">{solves(m)}</dd>
                  </dl>
                </li>
              ))}
            </ul>
            <div className="mt-10 rounded-2xl border border-white/10 bg-[#202227] max-sm:hidden">
              <table className="w-full text-left text-sm" data-testid="stats-table">
                <thead className="text-[#9C9AA3]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Method</th>
                    <th className="px-4 py-3 text-right font-medium">Turns</th>
                    <th className="px-4 py-3 text-right font-medium" title="Median time between two turns, leaving out pauses of more than eight seconds">
                      Pace
                    </th>
                    <th className="px-4 py-3 text-right font-medium" title="With the guide showing: how many turns were not the one it asked for">
                      Off the guide
                    </th>
                    <th className="px-4 py-3 text-right font-medium" title="Random scrambles solved without the guide or Solve for me">
                      Solves
                    </th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {used.map((m) => (
                    <tr key={m.method} className="border-t border-white/10" data-testid={`stats-${m.method}`}>
                      <td className="px-4 py-3 font-medium">{METHOD_NAME[m.method]}</td>
                      <td className="px-4 py-3 text-right">{m.turns}</td>
                      <td className="px-4 py-3 text-right">{pace(m)}</td>
                      <td className="px-4 py-3 text-right">{offGuide(m)}</td>
                      <td className="px-4 py-3 text-right">{solves(m)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <p className="mt-4 text-sm text-[#9C9AA3]">
          {summary.turns} turns and {summary.undos} undos recorded. A dash means too few turns to say (fewer than five).
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            data-testid="stats-download"
            disabled={events.length === 0}
            className="rounded-full bg-[#FFD500] px-5 py-2 text-sm font-semibold text-[#16171B] hover:bg-[#FFE04D] disabled:opacity-40"
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
            disabled={events.length === 0}
            className="rounded-full border border-white/15 px-5 py-2 text-sm font-medium hover:border-[#E5384F] hover:text-[#FF8A9A] disabled:opacity-40"
            onClick={() => {
              if (!window.confirm('Clear everything recorded about how you turn the cube? This cannot be undone.')) return
              clearUsage()
              setEvents([])
            }}
          >
            Clear
          </button>
        </div>
      </div>
    </main>
  )
}
