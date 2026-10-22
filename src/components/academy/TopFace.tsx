// "Hold it like this": the top face as a tutorial draws it, seen from above
// with the front at the bottom, a bar along each side for the top layer's side
// stickers. Each picture is a real position, held the way the lesson says
// (read off the cube engine, not drawn by hand). The sticker that decides how
// to hold it has a ring round it.

type Side = 'back' | 'front' | 'left' | 'right'
interface Picture {
  name: string
  hold: string
  /** Top stickers row by row from the back-left: Y yellow, - not yellow. */
  top: string
  /** Side stickers: back and front left to right, left and right from back to front. */
  sides?: Partial<Record<Side, string>>
  ring?: [Side | 'top', number]
}

const PICTURES: Record<string, Picture[]> = {
  'top-cross': [
    { name: 'Dot', hold: 'Any way round.', top: '----Y----' },
    { name: 'L', hold: 'At the back and the left.', top: '-Y-YY----' },
    { name: 'Line', hold: 'From left to right.', top: '---YYY---' },
  ],
  'top-face': [
    { name: 'One', hold: 'That corner at the front-left.', top: '-Y-YYYYY-', sides: { back: 'Y--', front: '--Y', right: 'Y--' }, ring: ['top', 6] },
    { name: 'None', hold: 'Front-left yellow facing left.', top: '-Y-YYY-Y-', sides: { left: 'Y-Y', right: 'Y-Y' }, ring: ['left', 2] },
    { name: 'Two', hold: 'Front-left yellow facing you.', top: 'YYYYYY-Y-', sides: { front: 'Y-Y' }, ring: ['front', 0] },
  ],
}

const S = 15 // a sticker
const G = 3 // the black between
const BAR = 5 // a side sticker, seen edge on
const YELLOW = '#ffd500'
const GREY = '#3a3d45'

function Sticker({ on, ring, w = S, h = S }: { on: boolean; ring: boolean; w?: number; h?: number }) {
  return (
    <span
      className={`block rounded-[3px] ${ring ? 'outline-2 outline-offset-1 outline-fg' : ''}`}
      style={{ width: w, height: h, background: on ? YELLOW : GREY }}
    />
  )
}

function Diagram({ p }: { p: Picture }) {
  const bar = (side: Side, horizontal: boolean) => (
    <span className={`flex ${horizontal ? 'flex-row' : 'flex-col'}`} style={{ gap: G }}>
      {[0, 1, 2].map((i) => (
        <Sticker key={i} on={p.sides?.[side]?.[i] === 'Y'} ring={p.ring?.[0] === side && p.ring[1] === i} w={horizontal ? S : BAR} h={horizontal ? BAR : S} />
      ))}
    </span>
  )
  return (
    <span className="grid w-max items-center justify-items-center" style={{ gridTemplateColumns: `${BAR}px auto ${BAR}px`, gap: G }}>
      <span />
      {bar('back', true)}
      <span />
      {bar('left', false)}
      <span className="grid rounded-[5px] bg-plastic" style={{ gridTemplateColumns: `repeat(3, ${S}px)`, gap: G, padding: G }}>
        {[...p.top].map((c, i) => (
          <Sticker key={i} on={c === 'Y'} ring={p.ring?.[0] === 'top' && p.ring[1] === i} />
        ))}
      </span>
      {bar('right', false)}
      <span />
      {bar('front', true)}
      <span />
    </span>
  )
}

export function TopFacePictures({ lessonId }: { lessonId: string }) {
  const pictures = PICTURES[lessonId]
  if (!pictures) return null
  return (
    <div className="mt-4">
      <p className="text-sm text-fg-muted">Hold it like this, seen from above with the front nearest you:</p>
      <ul className="mt-2.5 grid grid-cols-3 gap-2">
        {pictures.map((p) => (
          <li key={p.name} className="flex flex-col items-center rounded-lg bg-ink px-1.5 pb-2 pt-2.5 text-center">
            <span role="img" aria-label={`${p.name}: ${p.hold}`}>
              <Diagram p={p} />
            </span>
            <span aria-hidden className="mt-0.5 text-[11px] leading-none text-fg-faint">
              front
            </span>
            <span aria-hidden className="mt-2 font-display text-sm font-bold leading-tight text-fg">
              {p.name}
            </span>
            <span aria-hidden className="mt-0.5 text-[13px] leading-snug text-fg-muted">
              {p.hold}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
