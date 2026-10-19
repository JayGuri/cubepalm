import { HAND_COLOR, POSE_FOR, signForNotation, type ActiveSign, type SignLayer } from '../core/gestures/signGestures'
import { describeStep, type GuideState } from '../core/solvers/solveGuide'
import { CLOSE, PANEL_BUTTON } from './screens/play/buttonStyles'

// The in-app gesture key, the live "about to turn" HUD, and the guided-solve
// panel.

const FINGER_NAMES = ['index', 'middle', 'ring', 'pinky']

/** "index + middle" -- the fingers held up for a layer's sign. */
function poseWords(layer: SignLayer): string {
  return FINGER_NAMES.filter((_, i) => POSE_FOR[layer][i] === '1').join(' + ')
}

type HandName = 'Left' | 'Right'

/**
 * Four fingers, raised or folded, drawn as the BACK of the given hand as the
 * player sees it: a right hand has its thumb on the left (index first), a left
 * hand has its thumb on the right (pinky first). So for the left hand, "ring +
 * pinky" lights the two leftmost fingers, matching the player's own hand.
 */
export function PoseIcon({ layer, hand = 'Right', size = 22 }: { layer: SignLayer; hand?: HandName; size?: number }) {
  const pose = POSE_FOR[layer]
  const color = HAND_COLOR[hand]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label={`${hand} hand: ${poseWords(layer)}`} className="shrink-0">
      <rect x="4" y="13" width="16" height="9" rx="3" fill="#2C2E34" />
      {[0, 1, 2, 3].map((slot) => {
        // slot = position from the left of the icon; finger = which finger sits there.
        const finger = hand === 'Right' ? slot : 3 - slot
        const up = pose[finger] === '1'
        return (
          <rect
            key={slot}
            x={5 + slot * 4}
            y={up ? 2 : 10}
            width="3"
            height={up ? 12 : 4}
            rx="1.5"
            fill={up ? color : '#4B4D55'}
          />
        )
      })}
    </svg>
  )
}

/**
 * The hand signs for a run of moves, one chip each: which hand (by colour and
 * by the finger bars as that hand looks from the back) and which fingers.
 * A half turn is two quarter turns, so it shows two chips.
 */
export function SignSequence({ moves }: { moves: string }) {
  const notations = (moves.match(/[URFDLBMES]2?'?/g) ?? []).flatMap((m) => (m.includes('2') ? [m[0], m[0]] : [m]))
  return (
    <ol data-testid="sign-sequence" className="flex flex-wrap gap-1.5">
      {notations.map((n, i) => {
        const sign = signForNotation(n)
        if (!sign) return null
        return (
          <li
            key={i}
            title={`${sign.hand} hand, ${poseWords(sign.layer)}`}
            className="flex items-center gap-1 rounded-lg border bg-[#16171B] py-1 pl-1 pr-2"
            style={{ borderColor: HAND_COLOR[sign.hand] + '66' }}
          >
            <PoseIcon layer={sign.layer} hand={sign.hand} size={24} />
            <span className="font-mono text-sm text-[#ECEAE4]">{n}</span>
          </li>
        )
      })}
    </ol>
  )
}

const LAYERS: Array<{ layer: SignLayer; name: string }> = [
  { layer: 'R', name: 'Right' },
  { layer: 'U', name: 'Top' },
  { layer: 'F', name: 'Front' },
  { layer: 'L', name: 'Left' },
  { layer: 'D', name: 'Bottom' },
  { layer: 'B', name: 'Back' },
  { layer: 'M', name: 'Middle slice' },
  { layer: 'E', name: 'Equator slice' },
  { layer: 'S', name: 'Standing slice' },
]

export function HandsKey({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute inset-x-3 top-3 z-20 max-h-[calc(100%-4.5rem)] overflow-y-auto rounded-xl border border-white/10 bg-[#202227]/95 p-4 text-xs text-[#B2B0B9] shadow-lg backdrop-blur transition duration-200 starting:-translate-y-1 starting:opacity-0 @min-[40rem]:right-auto @min-[40rem]:left-4 @min-[40rem]:top-4 @min-[40rem]:w-72"
      data-testid="hands-help"
    >
      <div className="-mr-1.5 -mt-1.5 mb-1 flex items-center justify-between">
        <h2 className="font-display text-base font-bold text-[#ECEAE4]">Hand signs</h2>
        <button type="button" onClick={onClose} aria-label="Hide hand-control instructions" className={CLOSE}>
          ×
        </button>
      </div>

      <>
          <p className="text-[#ECEAE4]">
            Use both hands. The <b>fingers</b> pick the layer, the <b>hand</b> picks the direction:
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-md border py-1.5" style={{ borderColor: HAND_COLOR.Left + '66' }}>
              <div style={{ color: HAND_COLOR.Left }}>Left hand</div>
              <div>counter-clockwise ↺</div>
            </div>
            <div className="rounded-md border py-1.5" style={{ borderColor: HAND_COLOR.Right + '66' }}>
              <div style={{ color: HAND_COLOR.Right }}>Right hand</div>
              <div>clockwise ↻</div>
            </div>
          </div>
          <p className="mt-2">Hold the sign still until the ring fills. Relax your hand, then sign again to repeat.</p>
          <ul className="mt-2 space-y-1" data-testid="signs-key">
            {LAYERS.map(({ layer, name }) => (
              <li key={layer} className="flex items-center gap-2 border-t border-white/5 pt-1">
                <PoseIcon layer={layer} hand="Left" />
                <PoseIcon layer={layer} hand="Right" />
                <span className="w-5 font-mono text-sm text-[#ECEAE4]">{layer}</span>
                <span className="flex-1">{name}</span>
                <span className="text-right text-[11px] text-[#9C9AA3]">{poseWords(layer)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px]">
            Tip: R, U, F count fingers from the index side (1, 2, 3); L, D, B count from the pinky side.
          </p>
      </>

      <p className="mt-2 border-t border-white/10 pt-2">
        Open hand: move to orbit. Two open hands: spread or pinch together to zoom. Hold a closed fist still to
        lock or unlock the view (or press Space).
      </p>
    </div>
  )
}

function Ring({ progress, color }: { progress: number; color: string }) {
  const r = 12
  const c = 2 * Math.PI * r
  return (
    <svg width={30} height={30} viewBox="0 0 30 30" aria-hidden>
      <circle cx="15" cy="15" r={r} fill="none" stroke="#ffffff1f" strokeWidth="3" />
      <circle
        cx="15"
        cy="15"
        r={r}
        fill="none"
        stroke={progress >= 1 ? '#22C55E' : color}
        strokeWidth="3"
        strokeDasharray={`${progress * c} ${c}`}
        transform="rotate(-90 15 15)"
      />
    </svg>
  )
}

export function SignsHud({ signs }: { signs: ActiveSign[] }) {
  return (
    <div data-testid="sign-hud" className="pointer-events-none flex flex-wrap justify-center gap-2 sm:gap-3">
      {signs.map((s) => (
        <div
          key={s.hand}
          className="flex items-center gap-2 rounded-xl border bg-[#16171B]/85 px-3 py-1.5"
          style={{ borderColor: HAND_COLOR[s.hand] + '88' }}
        >
          <Ring progress={s.progress} color={HAND_COLOR[s.hand]} />
          <span className="font-mono text-xl font-semibold text-[#ECEAE4]">{s.notation}</span>
          <span className="text-xs" style={{ color: HAND_COLOR[s.hand] }}>
            {s.hand} hand
          </span>
        </div>
      ))}
    </div>
  )
}

export function GuidePanel({
  guide,
  status,
  onStop,
  showHands,
  optimal = false,
  refining = false,
  touch = false,
  className = '',
}: {
  guide: GuideState | null
  status: 'solving' | 'following' | 'done'
  onStop: () => void
  showHands: boolean
  /** The route is provably the shortest there is. */
  optimal?: boolean
  /** A deeper search for a shorter route is running. */
  refining?: boolean
  /** No keyboard here: point at the on-screen turn buttons instead of a key. */
  touch?: boolean
  /** Where it sits on the stage (the play screen decides). */
  className?: string
}) {
  const step = guide ? guide.steps[guide.index] : null
  const sign = step ? signForNotation(step) : null
  const done = guide ? guide.index / guide.steps.length : 0
  // A slim strip centred just above the cube, so the move and the gold arrow
  // on the cube sit in one line of sight. It shows only the current move: the
  // cube itself, not a list of moves, is what the player should be watching.
  return (
    <div
      data-testid="guide-panel"
      className={`pointer-events-auto relative flex min-h-14 items-center gap-3 rounded-2xl border border-[#F5B83D]/40 bg-[#202227]/90 py-2 pl-4 pr-2 text-sm text-[#B2B0B9] shadow-lg backdrop-blur transition duration-200 starting:translate-y-1 starting:opacity-0 sm:gap-4 ${className}`}
    >
      {status === 'solving' && (
        <span data-testid="guide-solving" className="flex flex-1 items-center gap-3">
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-[#F5B83D]" aria-hidden />
          Finding a short solution…
        </span>
      )}

      {status === 'done' && (
        <span className="flex-1 font-semibold text-[#4ED48A]" data-testid="guide-done">
          Solved! Scramble again for another one.
        </span>
      )}

      {status === 'following' && guide && step && (
        <>
          {/* Keyed by position, so each new step arrives with a small pop: the move changed. */}
          <span
            key={guide.index}
            className="min-w-[2ch] font-display text-3xl font-bold text-[#F5B83D] transition duration-300 starting:scale-75 starting:opacity-0"
            data-testid="guide-step"
          >
            {step}
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="text-[#ECEAE4]">{describeStep(step)}</span>
            <span className="text-xs">
              {showHands && sign ? (
                <span data-testid="guide-sign">
                  <b style={{ color: HAND_COLOR[sign.hand] }}>{sign.hand} hand</b>, {poseWords(sign.layer)}
                </span>
              ) : touch ? (
                <span data-testid="guide-tap">Tap the gold button</span>
              ) : (
                <>
                  Key{' '}
                  <kbd className="rounded bg-white/10 px-1 text-[#ECEAE4]">
                    {step.endsWith("'") ? `Shift+${step[0]}` : step[0]}
                  </kbd>
                </>
              )}{' '}
              · <span data-testid="guide-progress">{guide.index + 1}/{guide.steps.length}</span>
              {optimal ? (
                <span data-testid="guide-optimal" className="text-[#4ED48A]">
                  {' '}
                  · shortest possible
                </span>
              ) : refining ? (
                <span data-testid="guide-refining"> · looking for shorter…</span>
              ) : null}
            </span>
          </span>
          {showHands && sign && <PoseIcon layer={sign.layer} hand={sign.hand} size={30} />}
        </>
      )}

      <button type="button" onClick={onStop} className={`${PANEL_BUTTON} shrink-0`} data-testid="guide-stop">
        {status === 'done' ? 'Close' : 'Stop'}
      </button>
      {status === 'following' && (
        <span className="absolute inset-x-4 bottom-0 h-0.5 overflow-hidden rounded-full bg-white/10">
          <span className="block h-full bg-[#F5B83D] transition-[width]" style={{ width: `${done * 100}%` }} />
        </span>
      )}
    </div>
  )
}
