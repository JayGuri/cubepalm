import { describe, expect, it } from 'vitest'
import sitemap from '../public/sitemap.xml?raw'
import { LESSONS } from './core/academy/lessons'
import { pageMeta, SITE } from './pageMeta'

describe('page meta', () => {
  it('gives every page its own title, description and address', () => {
    const paths = ['/', '/learn', ...LESSONS.map((l) => `/learn/${l.id}`), '/play/cube3', '/play/mirror', '/settings']
    const metas = paths.map(pageMeta)
    expect(new Set(metas.map((m) => m.title)).size).toBe(paths.length)
    expect(new Set(metas.map((m) => m.canonical)).size).toBe(paths.length)
    for (const m of metas) {
      expect(m.title.length).toBeLessThanOrEqual(75)
      expect(m.description.length).toBeGreaterThan(40)
      expect(m.description.length).toBeLessThanOrEqual(300)
      expect(m.canonical.startsWith(SITE)).toBe(true)
    }
  })

  it('a lesson page names the lesson and its place in the course', () => {
    const second = pageMeta('/learn/' + LESSONS[1].id)
    expect(second.title).toContain(LESSONS[1].title)
    expect(second.title).toContain(`lesson 2 of ${LESSONS.length}`)
  })

  it('an unknown address falls back to the home page, and a trailing slash does not matter', () => {
    expect(pageMeta('/nowhere').canonical).toBe(`${SITE}/`)
    expect(pageMeta('/learn/').canonical).toBe(`${SITE}/learn`)
  })

  it('the sitemap lists exactly the pages that have meta', () => {
    const listed = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])
    for (const url of listed) expect(pageMeta(url.slice(SITE.length)).canonical).toBe(url)
    expect(listed).toHaveLength(2 + LESSONS.length + 2)
  })
})
