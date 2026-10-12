import { expect, test } from '@playwright/test'

// Every page must fit the screen it is on: nothing running off the right edge,
// at the narrowest phone still in common use, a larger phone, a tablet and a
// laptop. A page that scrolls sideways has something overlapping or cut off.

const SIZES = [
  { name: 'small phone', width: 320, height: 640 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
]
const PAGES = ['/', '/learn', '/learn/cross', '/play/cube3', '/play/mirror', '/settings', '/stats', '/record']

for (const size of SIZES) {
  test(`no page runs off the side of a ${size.name} (${size.width} wide)`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: size.width, height: size.height })
    for (const path of PAGES) {
      await page.goto(path)
      await page.waitForTimeout(500)
      const overflow = await page.evaluate('document.documentElement.scrollWidth - window.innerWidth')
      expect(overflow, `${path} is ${overflow}px wider than a ${size.name}`).toBeLessThanOrEqual(0)
    }
    // The recorder once it is running (no camera here, so it shows its waiting state).
    await page.goto('/record')
    await page.getByTestId('record-start').click()
    await expect(page.getByTestId('record-step')).toBeVisible()
    expect(await page.evaluate('document.documentElement.scrollWidth - window.innerWidth')).toBeLessThanOrEqual(0)
    // Its two parts stack without overlapping: the status sits below or beside the prompt, never on it.
    const prompt = (await page.getByText(/Show the sign for R/).boundingBox())!
    const status = (await page.getByTestId('record-phase').boundingBox())!
    const overlap = prompt.x < status.x + status.width && status.x < prompt.x + prompt.width && prompt.y < status.y + status.height && status.y < prompt.y + prompt.height
    expect(overlap).toBe(false)
  })
}
