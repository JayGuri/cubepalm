import { expect, test } from '@playwright/test'

test('settings screen toggles persist across reload', async ({ page }) => {
  await page.goto('/settings')
  await page.getByTestId('colorblind-toggle').click()
  await page.reload()
  // The toggle's persisted state is verified via localStorage directly, since
  // the visual knob position is a CSS detail, not the contract under test.
  const stored = await page.evaluate(() => localStorage.getItem('cubepalm.settings.v1'))
  expect(stored).toContain('"colorblindPalette":true')
})

test('progress saved under the old name (Palmtwist) is carried over, not lost', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(`
    localStorage.clear()
    localStorage.setItem('palmtwist.academy.v1', '["basics","cross"]')
  `)
  await page.reload()
  expect(await page.evaluate(`localStorage.getItem('cubepalm.academy.v1')`)).toBe('["basics","cross"]')
  expect(await page.evaluate(`localStorage.getItem('palmtwist.academy.v1')`)).toBeNull()
})
