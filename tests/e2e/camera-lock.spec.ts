import { expect, test, type Page } from '@playwright/test'

async function open(page: Page) {
  await page.goto('/play/cube3')
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
  await page.waitForTimeout(300)
}

// Zoom with the wheel and orbit with a right-drag from empty space, then
// report whether the rendered pixels changed at all.
async function viewChangesAfterCameraInput(page: Page) {
  const canvas = page.locator('canvas')
  const before = await canvas.screenshot()
  const box = (await canvas.boundingBox())!
  // Empty space on the right: the left edge holds the tips panel.
  const x = box.x + box.width * 0.9
  const y = box.y + box.height * 0.5
  await page.mouse.move(x, y)
  await page.mouse.wheel(0, -400)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(x - 150, y + 40, { steps: 10 })
  await page.mouse.up({ button: 'right' })
  await page.waitForTimeout(400)
  const after = await canvas.screenshot()
  return !before.equals(after)
}

test('unlocked, wheel and right-drag move the camera', async ({ page }) => {
  await open(page)
  expect(await viewChangesAfterCameraInput(page)).toBe(true)
})

test('locked via the button, the camera does not move at all', async ({ page }) => {
  await open(page)
  await page.getByTestId('camera-lock').click()
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-camera-locked', 'true')
  await expect(page.getByTestId('lock-badge')).toBeVisible()
  expect(await viewChangesAfterCameraInput(page)).toBe(false)
})

test('Space toggles the lock on and off, and layer turns still work while locked', async ({ page }) => {
  await open(page)
  await page.locator('main').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('Space')
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-camera-locked', 'true')

  await page.keyboard.press('r')
  await expect(page.getByTestId('move-count')).toHaveText('1 moves')

  await page.keyboard.press('Space')
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-camera-locked', 'false')
})
