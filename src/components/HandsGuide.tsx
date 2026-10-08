import { HAND_COLOR, POSE_FOR, signForNotation, type ActiveSign, type SignLayer } from '../core/gestures/signGestures'
import { describeStep, type GuideState } from '../core/solvers/solveGuide'

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
function PoseIcon({ layer, hand = 'Right', size = 22 }: { layer: SignLayer; hand?: HandName; size?: number }) {
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
      className="absolute left-4 top-4 max-h-[calc(100%-2rem)] w-72 overflow-y-auto rounded-xl border border-white/10 bg-[#202227]/95 p-4 text-xs text-[#9C9AA3] shadow-lg"
      data-testid="hands-help"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-base font-bold text-[#ECEAE4]">Hand signs</h2>
        <button type="button" onClick={onClose} aria-label="Hide hand-control instructions" className="hover:text-[#ECEAE4]">
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
                <span className="text-[10px] text-[#6E6C75]">{poseWords(layer)}</span>
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
    <div data-testid="sign-hud" className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-3">
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
      className="absolute bottom-3 left-1/2 z-10 sm:bottom-auto sm:top-4 flex w-[calc(100%-1.5rem)] sm:w-auto max-w-[calc(100%-1.5rem)] sm:max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-4 overflow-hidden rounded-2xl border border-[#F5B83D]/40 bg-[#202227]/90 py-2 pl-4 pr-3 text-sm text-[#9C9AA3] shadow-lg backdrop-blur"
    >
      {status === 'solving' && <span data-testid="guide-solving">Finding the shortest solution…</span>}

      {status === 'done' && (
        <span className="text-[#22C55E]" data-testid="guide-done">
          Solved! Scramble again for another one.
        </span>
      )}

      {status === 'following' && guide && step && (
        <>
          <span className="font-display text-3xl font-bold text-[#F5B83D]" data-testid="guide-step">
            {step}
          </span>
          <span className="flex flex-col leading-tight">
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

      <button
        type="button"
        onClick={onStop}
        className="ml-1 rounded-full px-2 py-1 hover:bg-white/10 hover:text-[#ECEAE4]"
        data-testid="guide-stop"
      >
        {status === 'done' ? 'Close' : 'Stop'}
      </button>
      {status === 'following' && (
        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white/10">
          <span className="block h-full bg-[#F5B83D] transition-[width]" style={{ width: `${done * 100}%` }} />
        </span>
      )}
    </div>
  )
}
