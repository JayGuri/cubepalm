import { Link } from 'react-router-dom'
import { Logo } from '../../Logo'
import { SiteMenu } from '../../shell/SiteMenu'
import { HoldSquare } from '../../HandsGuide'
import { KEY_SURFACE, PANEL } from './buttonStyles'

export type InputMode = 'mouse' | 'hands'

const LOCK_PATH = { open: 'M3.5 6V4.5a2.5 2.5 0 0 1 5 0', shut: 'M3.5 6V4.5a2.5 2.5 0 0 1 5 0V6' }
function LockIcon({ shut, className = '' }: { shut: boolean; className?: string }) {
  return (
    <svg width="11" height="13" viewBox="0 0 12 14" aria-hidden className={`shrink-0 ${className}`}>
      <rect x="1" y="6" width="10" height="7.5" rx="2" fill={shut ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" />
      <path d={shut ? LOCK_PATH.shut : LOCK_PATH.open} fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

/**
 * The play screen's header: the logo, where you are (with the place's colour
 * as a sticker), and the controls that set how you play: what you turn the
 * cube with, the view lock, and the site menu.
 */
export function PlayHeader({
  lesson,
  title,
  place,
  inputMode,
  onInputMode,
  touchScreen,
  cameraLocked,
  onToggleLock,
}: {
  lesson?: { title: string }
  title: string
  /** The place's sticker colour, as a background class. */
  place: string
  inputMode: InputMode
  onInputMode: (mode: InputMode) => void
  touchScreen: boolean
  cameraLocked: boolean
  onToggleLock: () => void
}) {
  const half = (mode: InputMode) =>
    `relative min-h-8 min-w-11 rounded-md px-3 text-sm font-semibold transition-colors duration-300 pointer-coarse:min-h-11 max-[22rem]:px-2.5 ${
      inputMode === mode ? 'text-plastic' : 'text-fg-muted hover:text-fg'
    }`
  return (
    <header className="relative z-10 flex shrink-0 items-center gap-3 bg-panel px-3 py-2.5 shadow-[0_1px_0_rgb(0_0_0/0.45)] pointer-coarse:py-2 sm:px-6 [@media(max-height:30rem)]:py-1.5">
      <Logo size={34} iconOnlyOnPhone />
      <div className="flex min-w-0 items-center gap-2.5 text-sm text-fg-faint max-sm:hidden">
        <span aria-hidden className={`sticker size-2.5 shrink-0 rounded-[3px] ${place}`} />
        {lesson ? (
          <>
            <Link to="/learn" className="hover:text-fg">
              Learn
            </Link>
            <span className="text-white/20" aria-hidden>
              /
            </span>
            <span className="truncate">{lesson.title}</span>
          </>
        ) : (
          <h1 className="truncate">{title}</h1>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Two halves on a strip of plastic; the yellow sticker slides under the one in use. */}
        <div role="group" aria-label="Control with" className="relative grid grid-cols-2 rounded-lg bg-plastic p-0.5 shadow-[inset_0_1px_2px_rgb(0_0_0/0.5)]">
          <span
            aria-hidden
            className="sticker absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-md bg-sticker-yellow transition-transform duration-300 ease-click"
            style={{ transform: inputMode === 'hands' ? 'translateX(100%)' : 'none' }}
          />
          <button type="button" data-testid="input-mode-mouse" aria-pressed={inputMode === 'mouse'} onClick={() => onInputMode('mouse')} className={half('mouse')}>
            {touchScreen ? 'Touch' : 'Mouse'}
          </button>
          <button type="button" data-testid="input-mode-hands" aria-pressed={inputMode === 'hands'} onClick={() => onInputMode('hands')} className={half('hands')}>
            Hands
          </button>
        </div>
        {/* A latching key: locked, it stays pushed in. */}
        <button
          type="button"
          data-testid="camera-lock"
          aria-pressed={cameraLocked}
          onClick={onToggleLock}
          title="Freeze the view so the cube stays put (Space, or hold a fist)"
          className={`inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-sm font-medium transition duration-200 ease-click select-none pointer-coarse:min-h-11 pointer-coarse:min-w-11 min-[25rem]:px-3 ${
            cameraLocked ? 'translate-y-px bg-plastic text-fg shadow-[inset_0_1px_3px_rgb(0_0_0/0.7)]' : `${KEY_SURFACE} text-fg-muted`
          }`}
        >
          <LockIcon shut={cameraLocked} />
          <span className="max-[25rem]:sr-only">{cameraLocked ? 'View locked' : 'Lock view'}</span>
        </button>
        <SiteMenu />
      </div>
    </header>
  )
}

/** On the stage: the view is locked, or a held fist is about to lock or unlock it. */
export function LockBadge({ locked, hold }: { locked: boolean; hold: number }) {
  return (
    <div
      data-testid="lock-badge"
      className={`flex items-center gap-2 self-start rounded-lg py-1 pl-1.5 pr-3 text-sm text-fg transition duration-300 ease-soft starting:opacity-0 ${PANEL}`}
    >
      {hold > 0 ? (
        <HoldSquare progress={hold} colour="#f4f5f8" size={22} />
      ) : (
        <span className="grid size-[22px] place-items-center">
          <LockIcon shut />
        </span>
      )}
      {hold > 0 ? (locked ? 'Keep holding to unlock…' : 'Keep holding to lock…') : 'View locked'}
    </div>
  )
}
