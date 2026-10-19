import { expect, test } from '@playwright/test'

test('keyboard alone can turn a face, and Shift+key gives the inverse', async ({ page }) => {
  await page.goto('/play/cube3')
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')

  await page.keyboard.press('u')
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')
  await expect(page.getByTestId('move-count')).toHaveText('1 move')

  await page.keyboard.press('Shift+U')
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')
  await expect(page.getByTestId('move-count')).toHaveText('2 moves')
})

test('keyboard input works without ever touching the mouse, alongside the existing controls', async ({ page }) => {
  await page.goto('/play/cube3')
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
  for (const key of ['r', 'u', 'r', 'u']) await page.keyboard.press(key)
  await expect(page.getByTestId('move-count')).toHaveText('4 moves')
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')

  // Mouse-driven Reset must still work after pure-keyboard play.
  await page.getByRole('button', { name: /^reset$/i }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')
})
