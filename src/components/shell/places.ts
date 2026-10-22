// The cube's six faces are the site's six places, each wearing its sticker's
// colour. The header, the menu (a cube net), the footer and the page turns all
// read from this one list.

export const GITHUB = 'https://github.com/JayGuri/cubepalm'

/** The sticker colours, as in the @theme block of index.css. */
export const STICKER = {
  white: '#f4f5f8',
  yellow: '#ffd500',
  red: '#f0566b',
  orange: '#ff8a00',
  green: '#2fb36b',
  blue: '#5b8def',
} as const

export interface Place {
  label: string
  to: string
  colour: string
  /** Where the face sits on a cube held white up, green to the front. */
  face: 'U' | 'L' | 'F' | 'R' | 'B' | 'D'
  external?: boolean
  /** Addresses that count as being on this face, besides `to` itself. */
  also?: RegExp
}

export const PLACES: Place[] = [
  { label: 'Learn', to: '/learn', colour: STICKER.orange, face: 'L', also: /^\/learn\// },
  { label: '3×3', to: '/play/cube3', colour: STICKER.green, face: 'F' },
  { label: 'Mirror', to: '/play/mirror', colour: STICKER.blue, face: 'B' },
  { label: 'Settings', to: '/settings', colour: STICKER.white, face: 'U', also: /^\/(stats|record)$/ },
  { label: 'Maths', to: '/how', colour: STICKER.red, face: 'R' },
  { label: 'Source', to: GITHUB, colour: STICKER.yellow, face: 'D', external: true },
]

/** The place a path belongs to: the face you are looking at. */
export function placeOf(pathname: string): Place | undefined {
  const path = pathname.replace(/\/+$/, '') || '/'
  return PLACES.find((p) => !p.external && (path === p.to || p.also?.test(path)))
}
