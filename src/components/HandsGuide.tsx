import type { ReactNode } from 'react'
import { HAND_COLOR, POSE_FOR, signForNotation, type ActiveSign, type SignLayer } from '../core/gestures/signGestures'
import { moveWords } from '../core/notation'
import { describeStep, type GuideState } from '../core/solvers/solveGuide'
import { TurnGlyph } from './cube/MoveChip'
import { CLOSE, KBD, PANEL, PANEL_BUTTON, STICKER } from './screens/play/buttonStyles'
import { FaceGlyph } from './screens/play/FaceGlyph'
import { RouteStrip } from './screens/play/RouteStrip'

// The in-app gesture key, the live "about to turn" HUD, and the guided-solve
// panel.

const FINGER_NAMES = ['index', 'middle', 'ring', 'pinky']

/** "index + middle" -- the fingers held up for a layer's sign. */
function poseWords(layer: SignLayer): string {
  return FINGER_NAMES.filter((_, i) => POSE_FOR[layer][i] === '1').join(' + ')
}

/** "R'" as a cube's notation is printed: with a real prime. */
const printed = (move: string) => move.replace("'", '’')

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
            className="flex items-center gap-1 rounded-lg bg-plastic py-1 pl-1 pr-2 ring-1 ring-inset"
            style={{ ['--tw-ring-color' as string]: HAND_COLOR[sign.hand] + '70' }}
          >
            <PoseIcon layer={sign.layer} hand={sign.hand} size={24} />
            <span className="font-display text-sm font-bold text-fg">{printed(n)}</span>
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

/** Each hand, with the colour it wears everywhere and the way it turns. */
function HandCard({ hand }: { hand: HandName }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-plastic px-2 py-1.5">
      <span className="sticker grid size-6 shrink-0 place-items-center rounded-[5px] text-plastic" style={{ background: HAND_COLOR[hand] }}>
        <TurnGlyph kind={hand === 'Left' ? 'counter' : 'clockwise'} size={14} className="opacity-90" />
      </span>
      <span className="leading-tight">
        <b className="block font-semibold" style={{ color: HAND_COLOR[hand] }}>
          {hand} hand
        </b>
        {hand === 'Left' ? 'counter-clockwise' : 'clockwise'}
      </span>
    </div>
  )
}

export function HandsKey({ onClose }: { onClose: () => void }) {
  return (
    <div
      className={`absolute inset-x-3 top-3 z-20 max-h-[calc(100%-4.5rem)] overflow-y-auto rounded-xl p-4 text-xs text-fg-muted transition duration-300 ease-soft starting:-translate-y-1 starting:opacity-0 @min-[40rem]:right-auto @min-[40rem]:left-4 @min-[40rem]:top-4 @min-[40rem]:w-72 ${PANEL}`}
      data-testid="hands-help"
    >
      <div className="-mr-1.5 -mt-1.5 mb-1 flex items-center justify-between">
        <h2 className="font-display text-base font-bold text-fg">Hand signs</h2>
        <button type="button" onClick={onClose} aria-label="Hide hand-control instructions" className={CLOSE}>
          ×
        </button>
      </div>

      <p className="text-fg">
        Use both hands. The <b>fingers</b> pick the layer, the <b>hand</b> picks the direction:
      </p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <HandCard hand="Left" />
        <HandCard hand="Right" />
      </div>
      <p className="mt-2.5">Hold the sign still until its square fills. Relax your hand, then sign again to repeat.</p>
      <ul className="mt-2" data-testid="signs-key">
        {LAYERS.map(({ layer, name }) => (
          <li key={layer} className="flex items-center gap-2 border-t border-white/6 py-1">
            <PoseIcon layer={layer} hand="Left" />
            <PoseIcon layer={layer} hand="Right" />
            <span className="w-4 font-display text-sm font-bold text-fg">{layer}</span>
            <span className="flex-1">{name}</span>
            <span className="text-right text-[11px] text-fg-faint">{poseWords(layer)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[11px]">R, U, F count fingers from the index side (1, 2, 3); L, D, B count from the pinky side.</p>

      <p className="mt-2.5 border-t border-white/8 pt-2.5">
        Open hand: move to orbit. Two open hands: spread or pinch together to zoom. Hold a closed fist still to lock or
        unlock the view (or press Space).
      </p>
    </div>
  )
}

/**
 * A sticker's outline, traced while something is held: when it closes, the
 * sticker clicks in and fills. A sign's square is traced the way its hand
 * turns the layer, clockwise for the right hand and back the other way for the
 * left (`mirror`).
 */
export function HoldSquare({
  progress,
  colour,
  size = 34,
  mirror = false,
  children,
}: {
  progress: number
  colour: string
  size?: number
  mirror?: boolean
  children?: ReactNode
}) {
  const done = progress >= 1
  return (
    <span
      className={`relative grid shrink-0 place-items-center transition-transform duration-300 ease-click ${done ? 'scale-100' : 'scale-[0.94]'}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden className={`absolute inset-0 ${mirror ? '-scale-x-100' : ''}`}>
        <rect x="1.75" y="1.75" width="26.5" height="26.5" rx="6.5" fill={done ? colour : 'none'} stroke="rgb(255 255 255 / 0.14)" strokeWidth="3" />
        <rect
          x="1.75"
          y="1.75"
          width="26.5"
          height="26.5"
          rx="6.5"
          fill="none"
          stroke={colour}
          strokeWidth="3"
          pathLength={1}
          strokeDasharray={`${progress} 1`}
          className="transition-[stroke-dasharray] duration-100 ease-linear"
        />
      </svg>
      <span className={`relative ${done ? 'text-plastic' : 'text-fg'}`}>{children}</span>
    </span>
  )
}

export function SignsHud({ signs }: { signs: ActiveSign[] }) {
  return (
    <div data-testid="sign-hud" className="pointer-events-none flex flex-wrap justify-center gap-2 sm:gap-3">
      {signs.map((s) => (
        <div key={s.hand} className={`flex items-center gap-2.5 rounded-xl py-1.5 pl-1.5 pr-3 ${PANEL}`}>
          <HoldSquare progress={s.progress} colour={HAND_COLOR[s.hand]} mirror={s.hand === 'Left'}>
            <span className="font-display text-lg font-bold leading-none">{printed(s.notation)}</span>
          </HoldSquare>
          <span className="flex flex-col text-xs leading-tight">
            <b className="font-semibold" style={{ color: HAND_COLOR[s.hand] }}>
              {s.hand} hand
            </b>
            <span className="text-fg-muted">{moveWords(s.notation)}</span>
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
  // A strip near the cube, so the move and the arrow on the cube sit in one
  // line of sight: the move to make now as a yellow sticker, the one just made
  // and the next few beside it, and the same move in words.
  return (
    <div
      data-testid="guide-panel"
      className={`pointer-events-auto flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl p-2 text-sm text-fg-muted transition duration-300 ease-soft starting:translate-y-1 starting:opacity-0 ${PANEL} ${className}`}
    >
      {status === 'solving' && (
        <span data-testid="guide-solving" className="flex min-h-10 flex-1 items-center gap-3 pl-1.5">
          <FaceGlyph mode="thinking" colour={STICKER.yellow} />
          Finding a short solution…
        </span>
      )}

      {status === 'done' && (
        <span className="flex min-h-10 flex-1 items-center gap-3 pl-1.5 font-semibold text-fg" data-testid="guide-done">
          <FaceGlyph mode="solved" colour={STICKER.green} earn />
          Solved. Scramble again for another one.
        </span>
      )}

      {status === 'following' && guide && step && (
        <>
          <RouteStrip moves={guide.steps} index={guide.index} />
          {/* The move as the keyboard and the tests read it; the strip draws it. */}
          <span data-testid="guide-step" className="sr-only">
            {step}
          </span>
          <span className="flex min-w-48 flex-1 flex-col gap-1 leading-tight">
            <span className="text-fg">{describeStep(step)}</span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {showHands && sign ? (
                <span data-testid="guide-sign" className="flex items-center gap-1.5">
                  <PoseIcon layer={sign.layer} hand={sign.hand} size={20} />
                  <span>
                    <b className="font-semibold" style={{ color: HAND_COLOR[sign.hand] }}>
                      {sign.hand} hand
                    </b>
                    , {poseWords(sign.layer)}
                  </span>
                </span>
              ) : touch ? (
                <span data-testid="guide-tap">Tap the yellow button</span>
              ) : (
                <span className="flex items-center gap-1">
                  Key
                  {step.endsWith("'") && (
                    <>
                      <kbd className={KBD}>Shift</kbd>+
                    </>
                  )}
                  <kbd className={KBD}>{step[0]}</kbd>
                </span>
              )}
              <span>
                Step{' '}
                <span data-testid="guide-progress" className="tabular-nums text-fg">
                  {guide.index + 1}/{guide.steps.length}
                </span>
              </span>
              {(optimal || refining) && (
                <span className="flex items-center gap-1.5">
                  {/* The search turns this face while it looks; proof that nothing shorter exists settles it. */}
                  <FaceGlyph mode={optimal ? 'solved' : 'thinking'} colour={STICKER.green} sticker={4} earn />
                  {optimal ? (
                    <span data-testid="guide-optimal" className="font-semibold text-sticker-green">
                      Shortest possible
                    </span>
                  ) : (
                    <span data-testid="guide-refining">Looking for a shorter route</span>
                  )}
                </span>
              )}
            </span>
          </span>
        </>
      )}

      <button type="button" onClick={onStop} className={`${PANEL_BUTTON} ml-auto`} data-testid="guide-stop">
        {status === 'done' ? 'Close' : 'Stop'}
      </button>
    </div>
  )
}
