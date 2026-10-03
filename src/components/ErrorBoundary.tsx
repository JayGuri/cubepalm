import { Component, type ErrorInfo, type ReactNode } from 'react'

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
      <main className="grid min-h-dvh place-items-center bg-[#16171B] p-8 text-center text-[#ECEAE4]" data-testid="screen-error">
        <div className="max-w-sm">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            {offline ? 'This page did not finish loading.' : 'Something went wrong on this page.'}
          </h1>
          <p className="mt-3 text-[#9C9AA3]">
            {offline ? 'Check your connection and load it again.' : 'Your progress and settings are saved on this device and are not affected.'}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              className="rounded-full bg-[#FFD500] px-6 py-2.5 font-semibold text-[#16171B] hover:bg-[#FFE04D]"
              onClick={() => (offline ? window.location.reload() : this.setState({ error: null }))}
            >
              {offline ? 'Reload' : 'Try again'}
            </button>
            <a href="/" className="rounded-full border border-white/20 px-6 py-2.5 font-semibold hover:border-white/50">
              Go to the home page
            </a>
          </div>
        </div>
      </main>
    )
  }
}
