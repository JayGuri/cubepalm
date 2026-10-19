/// <reference lib="dom" />
// The callbacks passed to page.evaluate run in the browser, so this file needs its types.
import { expect, test, type Page } from '@playwright/test'

// Site-wide checks that should always hold, found worth pinning by the
// refinement-pass audit: clean console, links that resolve, specific titles,
// a dialog that Escape closes, reduced motion respected, touch-sized controls.

const LESSONS = ['basics', 'cross', 'corners', 'middle', 'top-cross', 'top-face', 'top-corners', 'top-edges']
const PAGES = ['/', '/learn', ...LESSONS.map((l) => `/learn/${l}`), '/play/cube3', '/play/mirror', '/settings', '/stats', '/record']
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }

// Known noise from three.js, MediaPipe and the software WebGL of a headless browser.
const IGNORE = [/THREE\.Clock/, /OpenGL error checking is disabled/, /GL Driver Message/, /\[vite\]/, /React DevTools/]

async function settle(page: Page, path: string) {
  if (path.startsWith('/play/') || path.startsWith('/learn/')) {
    await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 })
  }
  await page.waitForTimeout(500)
}

for (const [name, options] of [
  ['phone', PHONE],
  ['laptop', { viewport: { width: 1280, height: 800 } }],
] as const) {
  test(`no console errors or warnings on any page (${name})`, async ({ browser }) => {
    test.setTimeout(300_000)
    const ctx = await browser.newContext(options)
    const page = await ctx.newPage()
    const problems: string[] = []
    let at = ''
    page.on('console', (m) => {
      if ((m.type() === 'error' || m.type() === 'warning') && !IGNORE.some((r) => r.test(m.text()))) problems.push(`${at} ${m.type()}: ${m.text().slice(0, 200)}`)
    })
    page.on('pageerror', (e) => problems.push(`${at} uncaught: ${e.message}`))
    for (const path of [...PAGES, '/no-such-page']) {
      at = path
      await page.goto(path)
      await settle(page, path)
    }
    await ctx.close()
    expect(problems).toEqual([])
  })
}

test('every link resolves: internal ones to a real page, external ones open safely in a new tab', async ({ page }) => {
  test.setTimeout(300_000)
  const internal = new Set<string>()
  const unsafe: string[] = []
  for (const path of PAGES) {
    await page.goto(path)
    await settle(page, path)
    for (const link of await page.locator('a[href]').evaluateAll((as) => as.map((a) => ({ href: a.getAttribute('href')!, target: a.getAttribute('target'), rel: a.getAttribute('rel') ?? '' })))) {
      if (/^https?:/.test(link.href)) {
        if (link.target !== '_blank' || !/noreferrer|noopener/.test(link.rel)) unsafe.push(`${path}: ${link.href}`)
      } else if (link.href.startsWith('/')) internal.add(link.href.split('#')[0])
    }
  }
  expect(unsafe).toEqual([])
  for (const href of internal) {
    await page.goto(href)
    await page.waitForTimeout(300)
    // Unknown addresses either show the not-found page or bounce elsewhere; a real link does neither.
    expect(new URL(page.url()).pathname, `${href} redirected`).toBe(href)
    await expect(page.getByText('There is no page here'), `${href} is a dead link`).toHaveCount(0)
  }
})

test('each page has its own title, and an unknown address says so', async ({ page }) => {
  const titles = new Map<string, string>()
  for (const path of PAGES) {
    await page.goto(path)
    await expect(page).toHaveTitle(/CubePalm/)
    titles.set(path, await page.title())
  }
  // Every page but the home page names itself first and the site last.
  for (const [path, title] of titles) if (path !== '/') expect(title, path).toMatch(/ \| CubePalm$/)
  expect(new Set(titles.values()).size).toBe(titles.size)
  await page.goto('/no-such-page')
  await expect(page).toHaveTitle(/not found/i)
})

test('Escape closes the scramble dialog and gives focus back to the button that opened it', async ({ page }) => {
  await page.goto('/play/cube3')
  await settle(page, '/play/cube3')
  const trigger = page.getByTestId('custom-scramble')
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('scramble-dialog')).toBeVisible()
  await expect(page.getByTestId('scramble-input')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('scramble-dialog')).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('with reduced motion asked for, nothing on the home page animates forever', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForTimeout(1000)
  // A looping animation squeezed to 0.01ms does not stop: it strobes through every frame.
  const looping = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations === Infinity)
      .map((a) => (a as CSSAnimation).animationName ?? 'animation'),
  )
  expect(looping).toEqual([])
})

test('a lesson starts its move counter at 0, not at the turns that set up the position', async ({ page }) => {
  await page.goto('/learn/corners')
  await settle(page, '/learn/corners')
  await expect(page.getByTestId('move-count')).toHaveText(/^0 moves?$/)
})

test('on a landscape phone, the play controls are not covered by anything', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  await page.goto('/play/cube3')
  await settle(page, '/play/cube3')
  const covered = await page.evaluate(() =>
    [...document.querySelectorAll('footer button, [data-testid=move-pad] button')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return !top || !(el === top || el.contains(top))
      })
      .map((el) => el.getAttribute('aria-label') || (el as HTMLElement).innerText),
  )
  await ctx.close()
  expect(covered).toEqual([])
})

test('on a phone, every control is at least 44px in both directions', async ({ browser }) => {
  test.setTimeout(300_000)
  const ctx = await browser.newContext(PHONE)
  const page = await ctx.newPage()
  const small: string[] = []
  for (const path of PAGES) {
    await page.goto(path)
    await settle(page, path)
    const found = await page.evaluate(() =>
      [...document.querySelectorAll('a[href], button, input, select, textarea, [role=switch]')]
        .filter((el) => {
          const r = el.getBoundingClientRect()
          const s = getComputedStyle(el)
          if (!r.width || !r.height || s.visibility === 'hidden') return false
          // Visually hidden (an sr-only wrapper clips to 1px): not a touch target.
          for (let p = el.parentElement; p; p = p.parentElement) if (p.getBoundingClientRect().width <= 1) return false
          // A link inside a sentence is exempt (WCAG 2.5.8).
          if (el.tagName === 'A' && el.parentElement?.closest('p')) return false
          return r.width < 44 || r.height < 44
        })
        .map((el) => {
          const r = el.getBoundingClientRect()
          return `${(el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.tagName).trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`
        }),
    )
    small.push(...found.map((f) => `${path}: ${f}`))
  }
  await ctx.close()
  expect(small).toEqual([])
})
