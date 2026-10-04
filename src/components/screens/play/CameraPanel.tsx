import type { RefObject } from 'react'
import { CameraDebugOverlay } from '../../CameraDebugOverlay'
import { GestureConfidenceIndicator } from '../../GestureConfidenceIndicator'
import type { LandmarkFrame } from '../../../core/gestures/landmarks'

/** The small live view of your hands, with what the camera currently reads from them. */
export function CameraPanel({
  videoRef,
  frame,
  error,
  signs,
}: {
  videoRef: RefObject<HTMLVideoElement | null>
  frame: LandmarkFrame | null
  error: string | null
  /** The signs being held right now, as notation (e.g. "R"). */
  signs: string[]
}) {
  return (
    <div className="absolute right-3 top-3 w-32 overflow-hidden rounded-xl border border-white/10 bg-[#202227] shadow-lg sm:right-4 sm:top-4 sm:w-64">
      <div className="relative aspect-video bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="h-full w-full -scale-x-100 object-cover" playsInline muted data-testid="gesture-video" />
        <CameraDebugOverlay frame={frame} width={256} height={144} />
      </div>
      <div className="flex items-center justify-between px-2.5 py-1.5">
        <GestureConfidenceIndicator frame={frame} />
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
