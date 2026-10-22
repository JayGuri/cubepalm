// The play screen is made of the cube's two materials. A control is a key of
// raised black plastic, with a sheen along its top edge and a lip along its
// bottom; the main action is a yellow sticker. Pressing either pushes it in (down
// a pixel or two, the lip shrinking) and it clicks back out. A control with
// nothing to do lies flat: no lip, no sheen, nothing to press. Corners are about
// a fifth of the height, as on a sticker, and every control grows to a full
// fingertip (44 px) on a touch screen.

const PRESS = 'transition duration-200 ease-click select-none disabled:cursor-not-allowed'
const SHAPE = `inline-flex min-h-10 items-center justify-center gap-2 rounded-lg text-[0.8rem] font-medium sm:text-sm pointer-coarse:min-h-11 ${PRESS}`

/** Raised plastic, pressable: the surface of every ordinary control. */
export const KEY_SURFACE =
  'bg-raised text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.07),inset_0_-2px_0_rgb(0_0_0/0.45)] not-disabled:hover:bg-[#272a31] not-disabled:active:translate-y-px not-disabled:active:shadow-[inset_0_1px_0_rgb(255_255_255/0.04),inset_0_-1px_0_rgb(0_0_0/0.45)] disabled:bg-transparent disabled:text-fg-faint/80 disabled:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]'
/** The yellow sticker, pressable: the surface of the main action. */
export const STICKER_SURFACE =
  'bg-sticker-yellow font-semibold text-plastic sticker not-disabled:hover:brightness-105 not-disabled:active:translate-y-0.5 not-disabled:active:shadow-[inset_0_1px_0_rgb(255_255_255/0.28),inset_0_-1px_0_rgb(0_0_0/0.18)] disabled:bg-sticker-yellow/25 disabled:text-plastic/70 disabled:shadow-none'

export const BUTTON = `${SHAPE} ${KEY_SURFACE} px-3 sm:px-4`
/** The yellow sticker alone, for a button that sets its own width. */
export const PRIMARY_FILL = `${SHAPE} ${STICKER_SURFACE}`
export const PRIMARY = `${PRIMARY_FILL} px-3.5 sm:px-5`
/** A square key holding an icon (the solution player's transport). */
export const ICON_KEY = `${SHAPE} w-10 shrink-0 px-0 pointer-coarse:w-11`

/** A smaller key inside a floating panel: Stop, Close. */
export const PANEL_BUTTON = `inline-flex min-h-9 shrink-0 items-center justify-center rounded-md px-3 text-sm font-medium pointer-coarse:min-h-11 ${PRESS} ${KEY_SURFACE}`
/** The x that closes a floating panel: quiet until it is pointed at. */
export const CLOSE =
  'grid h-8 w-8 shrink-0 place-items-center rounded-md text-lg leading-none text-fg-faint transition duration-200 ease-click hover:bg-white/6 hover:text-fg active:translate-y-px pointer-coarse:h-11 pointer-coarse:w-11'

/** A panel lying on the stage: moulded plastic with a lamp's highlight on its top edge, lifted a little off the table. */
export const PANEL =
  'bg-panel ring-1 ring-white/6 shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_18px_36px_-18px_rgb(0_0_0/0.9)]'
/** A recessed window in the plastic, for a readout. */
export const WELL = 'bg-plastic shadow-[inset_0_1px_3px_rgb(0_0_0/0.6),0_1px_0_rgb(255_255_255/0.04)]'
/** A key cap, for naming a key on the keyboard. */
export const KBD =
  'inline-grid h-5 min-w-5 place-items-center rounded-[5px] bg-raised px-1 font-sans text-[0.7rem] font-bold leading-none text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.08),inset_0_-2px_0_rgb(0_0_0/0.5)]'

/** The six sticker colours (the tokens in index.css), for drawing that needs the values themselves. */
export const STICKER = {
  white: '#f4f5f8',
  yellow: '#ffd500',
  red: '#f0566b',
  orange: '#ff8a00',
  green: '#2fb36b',
  blue: '#5b8def',
} as const
