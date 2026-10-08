/** The small round button that brings the tips back. */
export function TipsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid="tips-open"
      onClick={onClick}
      aria-label="Show tips"
      title="How to turn the cube"
      className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-[#202227] text-base font-bold text-[#9C9AA3] hover:text-[#ECEAE4] sm:left-4 sm:top-4"
    >
      ?
    </button>
  )
}

export function MouseTips({ onClose, mirror }: { onClose: () => void; mirror: boolean }) {
  return (
    <div
      data-testid="mouse-tips"
      className="absolute left-4 top-4 w-[calc(100%-2rem)] rounded-xl border border-white/10 bg-[#202227]/95 p-4 text-sm text-[#9C9AA3] shadow-lg sm:w-72"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h2 className="font-display text-base font-bold text-[#ECEAE4]">How to turn the cube</h2>
        <button type="button" onClick={onClose} aria-label="Hide tips" className="text-lg leading-none hover:text-[#ECEAE4]">
          ×
        </button>
      </div>
      <ul className="space-y-1.5">
        {mirror && (
          <li>
            <b className="text-[#ECEAE4]">Solved</b> when the blocks form a perfect cube again. The thick blocks belong on
            the Right, Top and Front.
          </li>
        )}
        <li>
          <b className="text-[#ECEAE4]">Drag a {mirror ? 'block' : 'piece'}</b> to turn its layer.
        </li>
        <li>
          <b className="text-[#ECEAE4]">Drag empty space</b> or right-drag to look around; scroll to zoom.
        </li>
        <li className="max-sm:hidden">
          Or press <Kbd>R</Kbd> <Kbd>U</Kbd> <Kbd>F</Kbd> <Kbd>L</Kbd> <Kbd>D</Kbd> <Kbd>B</Kbd>, with <Kbd>Shift</Kbd> to
          turn the other way.
        </li>
        <li className="max-sm:hidden">
          <Kbd>Space</Kbd> locks the view.
        </li>
      </ul>
      <p className="mt-3 border-t border-white/10 pt-3 max-sm:hidden">
        Press <b className="text-[#ECEAE4]">Scramble</b> and solve it yourself. Stuck?{' '}
        <b className="text-[#F5B83D]">Guide me</b> shows the next move.
      </p>
      <p className="mt-2 max-sm:hidden">
        <b className="text-[#ECEAE4]">Undo</b> takes back your own turns and <b className="text-[#ECEAE4]">Reset</b> returns to the
        scramble you were given; neither solves it for you. The arrow beside Scramble sets up one you choose.
      </p>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 font-sans text-xs text-[#ECEAE4]">{children}</kbd>
}
