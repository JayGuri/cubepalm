import type { ReactNode } from 'react'
import { SiteFooter } from '../shell/SiteFooter'
import { SiteNav } from '../SiteNav'
import '../../styles/pages.css'

/** Settings, Stats and the Recorder: the nav, the page itself, and the footer that closes it. */
export function PageFrame({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-dvh bg-ink px-4 pb-10 pt-6 text-fg sm:px-6 sm:pt-8">
      <div className={`mx-auto ${wide ? 'max-w-3xl' : 'max-w-2xl'}`}>
        <SiteNav size={40} />
        <main>{children}</main>
        <SiteFooter />
      </div>
    </div>
  )
}
