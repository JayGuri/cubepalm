import { Logo } from '../Logo'
import { ColourStrip } from '../SiteNav'

// The foot of every page. (A first version: the shell is being redesigned.)
export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-white/10 pt-8 text-sm text-fg-faint sm:mt-28">
      <ColourStrip />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <span className="text-fg">
          <Logo size={32} />
        </span>
        <p>
          Made by{' '}
          <a href="https://github.com/JayGuri" target="_blank" rel="noreferrer" className="text-fg underline decoration-white/40 underline-offset-4 hover:decoration-white">
            Jay Guri
          </a>
          . Runs entirely in your browser.
        </p>
      </div>
    </footer>
  )
}
