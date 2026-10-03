import { expect, test } from '@playwright/test'

test('Home links to the Mirror Cube, and it loads', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('play-mirror').click()
  await expect(page).toHaveURL(/\/play\/mirror/)
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')
})

test('a turn and its inverse bring the Mirror Cube back to its solved shape', async ({ page }) => {
  await page.goto('/play/mirror')
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
  await page.waitForTimeout(500)
  const canvas = page.locator('canvas')
  const solved = await canvas.screenshot()
  await page.keyboard.press('r')
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')
  await page.waitForTimeout(500)
  // The shape really changed on screen.
  expect((await canvas.screenshot()).equals(solved)).toBe(false)
  await page.keyboard.press('Shift+R')
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')
})

test('Scramble then Solve for me returns the Mirror Cube to solved', async ({ page }) => {
  // The Mirror Cube's metal blocks draw slowly without a graphics card (about a
  // second a turn in a headless browser), so this is given time, not a race.
  test.setTimeout(240_000)
  await page.goto('/play/mirror')
  await expect(page.getByTestId('app')).toHaveAttribute('data-solver-ready', 'true', { timeout: 30_000 })
  await page.getByRole('button', { name: /scramble/i }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled', { timeout: 30_000 })
  await expect(page.getByRole('button', { name: /solve for me/i })).toBeEnabled({ timeout: 90_000 })
  await page.getByRole('button', { name: /solve for me/i }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Solved', { timeout: 120_000 })
})

test('the guide works on the Mirror Cube', async ({ page }) => {
  await page.goto('/play/mirror')
  await expect(page.getByTestId('app')).toHaveAttribute('data-solver-ready', 'true', { timeout: 30_000 })
  await page.keyboard.press('u')
  await page.keyboard.press('f')
  await page.getByTestId('guide-me').click()
  await expect(page.getByTestId('guide-step')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('puzzle-canvas')).not.toHaveAttribute('data-guide-move', '')
})

test('dragging a piece turns a layer, even after pieces have been rotated', async ({ page }) => {
  await page.goto('/play/mirror')
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
  await page.keyboard.press('r')
  await page.keyboard.press('u')
  await expect(page.getByTestId('move-count')).toHaveText('2 moves')
  await page.waitForTimeout(600)
  const box = (await page.locator('canvas').boundingBox())!
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.55)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.5 + 80, box.y + box.height * 0.55, { steps: 10 })
  await page.mouse.up()
  await expect(page.getByTestId('move-count')).toHaveText('3 moves')
})
