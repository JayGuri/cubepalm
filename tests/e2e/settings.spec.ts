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

test('turns are logged by input method, on this device, and shown on the stats page', async ({ page }) => {
  await page.goto('/play/cube3')
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
  for (const key of ['r', 'u', 'f', 'r', 'u', 'f', 'r']) {
    await page.keyboard.press(key)
    await page.waitForTimeout(260)
  }
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.goto('/settings')
  await page.getByTestId('open-stats').click()
  const keys = page.getByTestId('stats-keys')
  await expect(keys).toContainText('Keyboard')
  await expect(keys).toContainText('7')
  // Six gaps between seven turns: enough to state a pace.
  await expect(keys).toContainText('a minute')
  await expect(page.getByTestId('stats-drag')).toHaveCount(0)
  await expect(page.getByText('7 turns and 1 undo recorded')).toBeVisible()

  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByTestId('stats-clear').click()
  await expect(page.getByTestId('stats-empty')).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('stats-empty')).toBeVisible()
})

test('the recorder says what it keeps before asking for the camera', async ({ page }) => {
  await page.goto('/settings')
  await page.getByTestId('open-record').click()
  await expect(page.getByRole('heading', { name: 'Record your hand signs' })).toBeVisible()
  await expect(page.getByText('What is not kept: any picture or video')).toBeVisible()
  await expect(page.getByTestId('record-start')).toBeVisible()
  // Nothing has asked for the camera yet.
  await expect(page.locator('video')).toHaveCount(0)
})

test('Sign reading can be switched to Precise and is remembered', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByTestId('sign-reading')).toHaveValue('classic')
  await page.getByTestId('sign-reading').selectOption('precise')
  await page.reload()
  await expect(page.getByTestId('sign-reading')).toHaveValue('precise')
})
