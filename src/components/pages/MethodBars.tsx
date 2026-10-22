import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

// One measure across the input methods as a small bar chart: a bar per method
// from one baseline, the best of them in white (the white face) and the rest in
// grey, the value at the tip. Drawn to the pixel, so the text never scales.

export interface Bar {
  name: string
  /** Null when there are too few turns to say. */
  value: number | null
  /** The value as written at the tip. */
  text: string
}

const ROW = 30
const THICK = 14
const LABEL = 100 // room for "Turn buttons"
const TIP = 56 // room for the value after the longest bar
const BEST = '#F4F5F8'
const REST = '#6F717A' // 3.5:1 on the panel

/** A bar square at the baseline and rounded at its end, like a sticker strip laid from an edge. */
function barPath(x: number, y: number, w: number, h: number, r = 3): string {
  if (w <= r) return `M${x} ${y}h${w}v${h}h${-w}z`
  return `M${x} ${y}h${w - r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - r)}z`
}

export function MethodBars({ title, takeaway, bars, better }: { title: string; takeaway: string; bars: Bar[]; better: 'more' | 'less' }) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    setWidth(el.clientWidth)
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const known = bars.filter((b): b is Bar & { value: number } => b.value !== null)
  const max = Math.max(...known.map((b) => b.value), 0)
  const bestValue = known.length ? (better === 'more' ? max : Math.min(...known.map((b) => b.value))) : null
  const best = bars.findIndex((b) => b.value === bestValue)
  const plot = Math.max(0, width - LABEL - TIP)
  const height = bars.length * ROW

  return (
    <div className="plastic rounded-2xl p-4 sm:p-5">
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mt-0.5 text-sm text-fg-faint">{takeaway}</p>
      <div ref={box} className="mt-3">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${title}: ${bars.map((b) => `${b.name} ${b.value === null ? 'too few turns to say' : b.text}`).join(', ')}`}
          className="block overflow-visible"
        >
          {width > 0 && (
            <>
              <line x1={LABEL - 0.5} x2={LABEL - 0.5} y1={2} y2={height - 2} stroke="#34363E" />
              {bars.map((b, i) => {
                const y = i * ROW
                const w = b.value === null || max === 0 ? 0 : Math.max(2, (b.value / max) * plot)
                return (
                  <g key={b.name}>
                    <text x={0} y={y + ROW / 2} dominantBaseline="central" fill="#B2B0B9" fontSize={13}>
                      {b.name}
                    </text>
                    {b.value === null ? (
                      <text x={LABEL + 8} y={y + ROW / 2} dominantBaseline="central" fill="#9C9AA3" fontSize={13}>
                        too few turns
                      </text>
                    ) : (
                      <>
                        <path
                          d={barPath(LABEL, y + (ROW - THICK) / 2, w, THICK)}
                          fill={i === best ? BEST : REST}
                          className="pg-bar"
                          style={{ '--d': `${i * 70}ms` } as CSSProperties}
                        />
                        <text x={LABEL + w + 8} y={y + ROW / 2} dominantBaseline="central" fill="#ECEAE4" fontSize={13} fontWeight={700} className="tabular-nums">
                          {b.text}
                        </text>
                      </>
                    )}
                  </g>
                )
              })}
            </>
          )}
        </svg>
      </div>
    </div>
  )
}
