import { lessonById, LESSONS } from './core/academy/lessons'

// Every page says what it is. The cube screens are drawn on a canvas, which a
// search engine cannot read, so the title and description are what it has to go
// on -- and each lesson being its own page with its own words is how a search
// for "how to solve the white cross" can find the right one.

export const SITE = 'https://cubepalm.vercel.app'

export interface PageMeta {
  title: string
  description: string
  /** The one address this page should be known by. */
  canonical: string
}

const HOME: PageMeta = {
  title: "CubePalm: online Rubik's Cube you solve with hand gestures",
  description:
    "CubePalm is a free online Rubik's Cube and Mirror Cube you turn with hand gestures, with a step-by-step solver and lessons. Your webcam reads finger signs and nothing leaves your device.",
  canonical: `${SITE}/`,
}

export function pageMeta(pathname: string): PageMeta {
  const path = pathname.replace(/\/+$/, '') || '/'
  const at = (p: string) => `${SITE}${p}`

  if (path === '/learn') {
    return {
      title: "Learn to solve a Rubik's Cube: 8 short lessons | CubePalm",
      description:
        "Learn to solve a 3x3 Rubik's Cube one layer at a time. Eight short lessons with practice positions and a button that shows each move on the cube.",
      canonical: at('/learn'),
    }
  }
  if (path.startsWith('/learn/')) {
    const lesson = lessonById(path.slice('/learn/'.length))
    if (lesson) {
      const number = LESSONS.findIndex((l) => l.id === lesson.id) + 1
      return {
        title: `${lesson.title}: Rubik's Cube lesson ${number} of ${LESSONS.length} | CubePalm`,
        description: `${lesson.blurb} ${lesson.goalText}`.slice(0, 300),
        canonical: at(path),
      }
    }
  }
  if (path === '/play/cube3') {
    return {
      title: 'Online 3x3 Rubik\'s Cube with hand gestures and a solver | CubePalm',
      description:
        "Play a 3x3 Rubik's Cube in your browser. Drag it, use the keyboard, or turn layers with finger signs at your webcam. Scramble it, then solve it yourself or ask for the next move.",
      canonical: at(path),
    }
  }
  if (path === '/play/mirror') {
    return {
      title: 'Online Mirror Cube simulator: solve it by shape | CubePalm',
      description:
        'A silver Mirror Cube in your browser: one colour, blocks of uneven sizes, solved when the shape is a clean cube again. Turn it with the mouse, keyboard or hand gestures.',
      canonical: at(path),
    }
  }
  if (path === '/settings') {
    return { title: 'Settings | CubePalm', description: HOME.description, canonical: at('/settings') }
  }
  return HOME
}

/** Writes a page's meta into the document head: the title, the description and the canonical link. */
export function applyPageMeta(meta: PageMeta): void {
  document.title = meta.title
  const ensure = <T extends HTMLElement>(selector: string, create: () => T): T => {
    let el = document.head.querySelector<T>(selector)
    if (!el) {
      el = create()
      document.head.appendChild(el)
    }
    return el
  }
  ensure('meta[name="description"]', () => Object.assign(document.createElement('meta'), { name: 'description' })).setAttribute(
    'content',
    meta.description,
  )
  ensure('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' })).setAttribute('href', meta.canonical)
}
