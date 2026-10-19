// The two button looks of the play screen: an outlined one, and the filled
// yellow one for the main action. Both give way a little when pressed, and
// grow to a full fingertip (44 px) on a touch screen.
const SHAPE =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-full text-[0.8rem] sm:text-sm transition not-disabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:min-h-11'
export const BUTTON = `${SHAPE} border border-white/10 px-3 sm:px-4 font-medium text-[#ECEAE4] not-disabled:hover:border-white/30 not-disabled:hover:bg-white/[0.03]`
/** The yellow fill alone, for a button that sets its own width. */
export const PRIMARY_FILL = `${SHAPE} bg-[#FFD500] font-semibold text-[#16171B] not-disabled:hover:bg-[#FFE04D]`
export const PRIMARY = `${PRIMARY_FILL} px-3.5 sm:px-5`

/** A text button inside a floating panel: Stop, Close. */
export const PANEL_BUTTON =
  'inline-flex min-h-9 items-center rounded-full px-3 text-[#B2B0B9] transition hover:bg-white/10 hover:text-[#ECEAE4] active:scale-[0.97] pointer-coarse:min-h-11'
/** The × that closes a floating panel. */
export const CLOSE =
  'grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg leading-none text-[#9C9AA3] transition hover:bg-white/10 hover:text-[#ECEAE4] pointer-coarse:h-11 pointer-coarse:w-11'
