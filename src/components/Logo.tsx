import { Link } from 'react-router-dom'

// The CubePalm mark: a 3x3 cube seen corner-on, white on top, green on the
// left and red on the right -- the classic colours. It is drawn from one small
// bit of geometry, so every size (and the favicon) comes out identical.

const INK = '#10131A'
const TOP = '#F4F5F8'
const LEFT = '#2FB36B'
const RIGHT = '#E5384F'

type Vec = [number, number]
// Corner-on cube in a 48 x 48 box: the centre, and the three edges leaving it.
const CENTRE: Vec = [24, 24]
const UP_RIGHT: Vec = [18, -10.5]
const UP_LEFT: Vec = [-18, -10.5]
const DOWN: Vec = [0, 21]

const GAP = 0.05 // space between stickers, as a fraction of a sticker's width

// The nine stickers of one face, which is spanned by two of the cube's edges.
function faceStickers(a: Vec, b: Vec): string[] {
  const point = (p: number, q: number) => `${(CENTRE[0] + a[0] * p + b[0] * q).toFixed(2)} ${(CENTRE[1] + a[1] * p + b[1] * q).toFixed(2)}`
  const out: string[] = []
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const p0 = i / 3 + GAP
      const p1 = (i + 1) / 3 - GAP
      const q0 = j / 3 + GAP
      const q1 = (j + 1) / 3 - GAP
      out.push(`M${point(p0, q0)}L${point(p1, q0)}L${point(p1, q1)}L${point(p0, q1)}Z`)
    }
  }
  return out
}

const FACES = [
  { color: TOP, stickers: faceStickers(UP_RIGHT, UP_LEFT) },
  { color: LEFT, stickers: faceStickers(UP_LEFT, DOWN) },
  { color: RIGHT, stickers: faceStickers(UP_RIGHT, DOWN) },
]

function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <path d="M24 2.5 43.5 13.75V34.25L24 45.5 4.5 34.25V13.75Z" fill={INK} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      {FACES.map((face) => (
        <path key={face.color} d={face.stickers.join('')} fill={face.color} stroke={face.color} strokeWidth="0.9" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

export function Logo({ to = '/', size = 36, iconOnlyOnPhone = false }: { to?: string; size?: number; iconOnlyOnPhone?: boolean }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-3" aria-label="CubePalm, home">
      <span className="transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110">
        <LogoMark size={size} />
      </span>
      <span className={`font-display font-extrabold lowercase leading-none tracking-tight ${iconOnlyOnPhone ? 'max-[520px]:hidden' : ''}`} style={{ fontSize: size * 0.78 }}>
        cubepalm
      </span>
    </Link>
  )
}
