import { useState } from 'react'
import { Link } from 'react-router-dom'
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
          <div className="mt-10 rounded-2xl border border-white/10 bg-[#202227] p-6" data-testid="stats-empty">
            <p className="font-display text-xl font-bold">Nothing recorded yet</p>
            <p className="mt-2 max-w-xl text-[#9C9AA3]">
              Scramble a cube and turn it by dragging, with the keyboard, the turn buttons or hand signs, then come back. Six turns in a row
              with one method are enough to show its pace.
            </p>
            <Link
              to="/play/cube3"
              className="mt-5 inline-flex min-h-10 items-center rounded-full bg-[#FFD500] px-5 text-sm font-semibold text-[#16171B] hover:bg-[#FFE04D] pointer-coarse:min-h-11"
            >
              Play the 3×3
            </Link>
          </div>
        ) : (
          <>
            {/* Phone: one block per method, each figure on its own line. */}
            <ul className="mt-10 space-y-3 sm:hidden" data-testid="stats-list">
              {used.map((m) => (
                <li key={m.method} className="rounded-2xl border border-white/10 bg-[#202227] p-4">
                  <p className="font-display text-lg font-bold">{METHOD_NAME[m.method]}</p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm tabular-nums">
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
            <div className="mt-10 overflow-x-auto rounded-2xl border border-white/10 bg-[#202227] max-sm:hidden">
              <table className="w-full text-left text-sm" data-testid="stats-table">
                <thead className="text-[#9C9AA3]">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Method</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Turns</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Pace</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Off the guide</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Solves</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {used.map((m) => (
                    <tr key={m.method} className="border-t border-white/10" data-testid={`stats-${m.method}`}>
                      <th scope="row" className="px-4 py-3 font-medium">{METHOD_NAME[m.method]}</th>
                      <td className="px-4 py-3 text-right">{m.turns}</td>
                      <td className="px-4 py-3 text-right">{pace(m)}</td>
                      <td className="px-4 py-3 text-right">{offGuide(m)}</td>
                      <td className="px-4 py-3 text-right">{solves(m)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-sm text-[#9C9AA3]">
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
                  <dt className="font-semibold">{term}</dt>
                  <dd className="text-[#9C9AA3]">{meaning}</dd>
                </div>
              ))}
            </dl>
          </>
        )}

        {events.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-3 border-t border-white/10 pt-6">
            <button
              type="button"
              data-testid="stats-download"
              className="min-h-10 rounded-full bg-[#FFD500] px-5 text-sm font-semibold text-[#16171B] hover:bg-[#FFE04D] pointer-coarse:min-h-11"
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
              className="min-h-10 rounded-full border border-white/20 px-5 text-sm font-medium hover:border-[#F0566B] hover:text-[#FF8A9A] pointer-coarse:min-h-11"
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
      </div>
    </main>
  )
}
