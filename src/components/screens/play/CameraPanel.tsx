import type { RefObject } from 'react'
import { CameraDebugOverlay } from '../../CameraDebugOverlay'
import { GestureConfidenceIndicator } from '../../GestureConfidenceIndicator'
import type { GestureFeed } from '../../../core/gestures/useHandGestures'

/** The small live view of your hands, with what the camera currently reads from them. */
export function CameraPanel({
  videoRef,
  feed,
  tracker,
  ready,
  error,
  signs,
}: {
  videoRef: RefObject<HTMLVideoElement | null>
  feed: GestureFeed
  /** Where the hand model is running; shown as a tooltip for troubleshooting. */
  tracker: string | null
  /** The camera is running and the hand model has loaded. */
  ready: boolean
  error: string | null
  /** The signs being held right now, as notation (e.g. "R"). */
  signs: string[]
}) {
  return (
    <div data-testid="camera-panel" data-tracker={tracker ?? ''} title={tracker ? `Hand tracking: ${tracker}` : undefined} className="absolute right-3 top-3 w-32 overflow-hidden rounded-xl border border-white/10 bg-[#202227] shadow-lg sm:right-4 sm:top-4 sm:w-64">
      <div className="relative aspect-video bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="h-full w-full -scale-x-100 object-cover" playsInline muted data-testid="gesture-video" />
        <CameraDebugOverlay feed={feed} width={256} height={144} />
        {!ready && !error && (
          <p className="absolute inset-0 grid place-items-center px-2 text-center text-[0.7rem] leading-snug text-[#9C9AA3] sm:text-xs" data-testid="camera-starting">
            Starting the camera. Allow it if your browser asks.
          </p>
        )}
      </div>
      <div className="flex items-center justify-between px-2.5 py-1.5">
        <GestureConfidenceIndicator feed={feed} />
        <span className="shrink-0 text-xs text-[#9C9AA3]" data-testid="gesture-state">
          {signs.length ? signs.join(' + ') : 'Show a sign'}
        </span>
      </div>
      {error && (
        <p className="bg-[#EF4444]/15 px-2.5 py-1.5 text-xs text-[#EF4444]" data-testid="gesture-error">
          {error}
        </p>
      )}
    </div>
  )
}
