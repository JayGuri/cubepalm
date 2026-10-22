import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ScrambledFace } from './shell/Faces'

// Catches anything a screen throws while rendering (a failed lazy load on a
// flaky connection, a bug) and offers a way forward instead of a blank page.

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Screen failed to render:', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    // A chunk that failed to download is fixed by loading the page again.
    const offline = /dynamically imported module|Loading chunk|Failed to fetch/i.test(error.message)
    return (
      <main className="grid min-h-dvh place-items-center bg-ink px-4 py-10 text-center text-fg sm:px-8" data-testid="screen-error">
        <div className="flex w-full max-w-md flex-col items-center">
          <ScrambledFace sticker={24} />
          <h1 className="font-display mt-8 text-3xl font-extrabold tracking-tight">
            {offline ? 'This page did not finish loading.' : 'Something went wrong on this page.'}
          </h1>
          <p className="mt-3 text-fg-muted">
            {offline
              ? navigator.onLine
                ? 'Part of it could not be downloaded. Loading it again usually fixes this.'
                : 'You seem to be offline. Check your connection, then load it again.'
              : 'Your progress and settings are saved on this device and are not affected.'}
          </p>
          <div className="mt-7 flex w-full flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              className="sticker min-h-11 rounded-xl bg-sticker-yellow px-6 font-semibold text-plastic hover:bg-[#ffe04d] active:translate-y-px"
              onClick={() => (offline ? window.location.reload() : this.setState({ error: null }))}
            >
              {offline ? 'Load it again' : 'Try again'}
            </button>
            {/* A full page load, not an in-app link: this boundary would keep showing the error otherwise. */}
            <a href="/" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-6 font-semibold hover:border-white/50">
              Go to the home page
            </a>
          </div>
          {!offline && (
            <details className="mt-8 w-full text-left text-sm text-fg-faint">
              <summary className="cursor-pointer text-center">What went wrong</summary>
              <p className="mt-3 wrap-break-word rounded-xl border border-white/10 bg-raised p-3 font-mono text-xs">{error.message || String(error)}</p>
            </details>
          )}
        </div>
      </main>
    )
  }
}
