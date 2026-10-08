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

test('turn speed is remembered, and Clear wipes saved progress after asking', async ({ page }) => {
  await page.goto('/settings')
  await page.getByTestId('turn-speed').selectOption('fast')
  await page.evaluate(`
    localStorage.setItem('cubepalm.best.v1', JSON.stringify({ cube3: { timeMs: 61000, moves: 80 } }))
    localStorage.setItem('cubepalm.academy.v1', '["basics"]')
  `)
  await page.reload()
  await expect(page.getByTestId('turn-speed')).toHaveValue('fast')

  // Saying no keeps everything.
  page.once('dialog', (dialog) => void dialog.dismiss())
  await page.getByTestId('clear-saved').click()
  expect(await page.evaluate(`localStorage.getItem('cubepalm.best.v1')`)).not.toBeNull()

  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByTestId('clear-saved').click()
  await expect(page.getByTestId('clear-saved')).toHaveText('Cleared')
  expect(await page.evaluate(`localStorage.getItem('cubepalm.best.v1')`)).toBeNull()
  expect(await page.evaluate(`localStorage.getItem('cubepalm.academy.v1')`)).toBe('[]')
})
