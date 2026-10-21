import { SiteNav } from '../SiteNav'

// How CubePalm works, shown rather than told: the maths of the cube, how a hand
// becomes a sign, how the solver searches and proves. Being built.

export function How() {
  return (
    <main className="min-h-dvh bg-ink px-4 py-8 text-fg sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <SiteNav size={40} />
        <h1 className="font-display mt-12 text-4xl font-extrabold tracking-tight sm:text-5xl">How it works</h1>
        <p className="mt-4 max-w-xl text-fg-muted">The maths of the cube, how a hand becomes a sign, and how the solver finds a route.</p>
      </div>
    </main>
  )
}
