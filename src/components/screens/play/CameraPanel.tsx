import type { RefObject } from 'react'
import { CameraDebugOverlay } from '../../CameraDebugOverlay'
import { GestureConfidenceIndicator } from '../../GestureConfidenceIndicator'
import { HAND_COLOR } from '../../../core/gestures/signGestures'
import type { GestureFeed } from '../../../core/gestures/useHandGestures'
import { PANEL, STICKER } from './buttonStyles'
import { FaceGlyph } from './FaceGlyph'

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
    <div
      data-testid="camera-panel"
      data-tracker={tracker ?? ''}
      title={tracker ? `Hand tracking: ${tracker}` : undefined}
      className={`absolute right-3 top-3 w-36 rounded-xl p-1 transition duration-300 ease-soft starting:opacity-0 @min-[40rem]:right-4 @min-[40rem]:top-4 @min-[40rem]:w-64 [@media(max-height:30rem)]:@min-[40rem]:w-48 ${PANEL}`}
    >
      {/* The picture sits in the plastic like a screen. */}
      <div className="relative aspect-video overflow-hidden rounded-lg bg-black shadow-[inset_0_0_0_1px_rgb(0_0_0/0.6)]">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="h-full w-full -scale-x-100 object-cover" playsInline muted data-testid="gesture-video" />
        <CameraDebugOverlay feed={feed} width={256} height={144} />
        {!ready && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-2 text-center text-[0.7rem] leading-snug text-fg-faint sm:text-xs" data-testid="camera-starting">
            <FaceGlyph mode="thinking" colour={STICKER.yellow} sticker={5} />
            Starting the camera. Allow it if your browser asks.
          </div>
        )}
      </div>
      {/* What the camera reads (on a narrow stage the panel is small: the reading stays, the hint
          goes). With no camera there is nothing to read, so only the problem is shown. */}
      {error ? (
        <p className="mt-1 rounded-lg bg-sticker-red/12 px-2 py-1.5 text-[0.7rem] leading-snug text-[#ff9aa8] @min-[40rem]:text-xs" data-testid="gesture-error">
          {error}
        </p>
      ) : (
        <div className="flex items-center justify-between gap-2 px-1.5 pb-0.5 pt-1.5">
          <GestureConfidenceIndicator feed={feed} />
          <span className="shrink-0 text-xs text-fg-muted @max-[40rem]:hidden" data-testid="gesture-state">
            {signs.length
              ? signs.map((s, i) => (
                  <span key={s}>
                    {i > 0 && ' + '}
                    <b className="font-display font-bold" style={{ color: HAND_COLOR[s.endsWith("'") ? 'Left' : 'Right'] }}>
                      {s.replace("'", '’')}
                    </b>
                  </span>
                ))
              : 'Show a sign'}
          </span>
        </div>
      )}
    </div>
  )
}
