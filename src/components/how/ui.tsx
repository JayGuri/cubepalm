import { useId, type ReactNode } from 'react'

// Small pieces shared by the How it works sections.

export const BUTTON =
  'sticker inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sticker-yellow px-5 font-bold text-plastic transition-[translate,filter,opacity] duration-200 ease-click hover:brightness-105 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0'
export const QUIET =
  'plastic inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-raised px-4 font-bold text-fg ring-1 ring-white/10 transition-[translate,box-shadow,opacity] duration-200 ease-click hover:ring-white/25 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45'
export const LINK = 'font-semibold underline decoration-white/35 underline-offset-4 hover:decoration-white'

/** The two kinds of number on the page: worked out here and now, or quoted from a measured report. */
export function Key({ kind }: { kind: 'live' | 'measured' }) {
  return <span aria-hidden className={`how-key how-key-${kind}`} />
}

export function Section({ id, title, lead, children }: { id: string; title: string; lead: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="how-section scroll-mt-6">
      <h2 id={`${id}-title`} className="how-h2 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      <div className="mt-4 max-w-2xl text-lg leading-relaxed text-pretty text-fg-muted">{lead}</div>
      {children}
    </section>
  )
}

/** A row of buttons of which one is chosen. */
export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
  testId,
}: {
  label: string
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
  testId?: string
}) {
  return (
    <div role="group" aria-label={label} className="how-choice inline-flex flex-wrap gap-1.5 rounded-xl bg-plastic p-1" data-testid={testId}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className="min-h-11 rounded-lg px-3 text-sm font-bold text-fg-muted transition-colors duration-200 hover:text-fg aria-pressed:bg-raised aria-pressed:text-fg aria-pressed:shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit = '',
  valueText,
  testId,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  unit?: string
  valueText?: string
  testId?: string
}) {
  const id = useId()
  const shown = valueText ?? `${value}${unit}`
  return (
    <div className="how-slider">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <label htmlFor={id} className="font-bold text-fg">
          {label}
        </label>
        <output htmlFor={id} className="tabular-nums text-fg-muted">
          {shown}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={shown}
        data-testid={testId}
        onChange={(e) => onChange(Number(e.target.value))}
        className="how-range w-full"
      />
    </div>
  )
}

/** A chart's data as a plain table, folded away: the same numbers without the picture. */
export function TableView({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="how-table mt-3 text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-fg-muted hover:text-fg">Show the numbers</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-max text-left tabular-nums">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h} scope="col" className="border-b border-white/10 px-2 py-1.5 font-semibold text-fg-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className="border-b border-white/5 px-2 py-1.5 text-fg">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

