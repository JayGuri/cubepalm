import { expect, test, type Page } from '@playwright/test'

async function open(page: Page) {
  await page.goto('/play/cube3')
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByTestId('app')).toHaveAttribute('data-solver-ready', 'true', { timeout: 30_000 })
}

const stepKey = (step: string) => (step.endsWith("'") ? `Shift+${step[0]}` : step[0].toLowerCase())
const oppositeKey = (step: string) => (step.endsWith("'") ? step[0].toLowerCase() : `Shift+${step[0]}`)

// The guide's position, so a test can wait for it to move on.
async function where(page: Page) {
  if (await page.getByTestId('guide-done').isVisible()) return 'done'
  if (await page.getByTestId('guide-solving').isVisible()) return 'solving'
  const step = await page.getByTestId('guide-step').textContent()
  const progress = await page.getByTestId('guide-progress').textContent()
  return `${step}|${progress}`
}

// Scramble, wait for it to land, then opt in to the guide.
async function scrambleThenGuide(page: Page) {
  await page.getByRole('button', { name: 'Scramble', exact: true }).click()
  await expect(page.getByTestId('guide-me')).toBeEnabled({ timeout: 30_000 })
  await page.getByTestId('guide-me').click()
  await expect(page.getByTestId('guide-step')).toBeVisible({ timeout: 30_000 })
}

async function followToTheEnd(page: Page) {
  for (let i = 0; i < 80; i++) {
    if (await page.getByTestId('guide-done').isVisible()) return
    // Between steps the guide may briefly be checking/re-solving.
    await expect(page.getByTestId('guide-step').or(page.getByTestId('guide-done'))).toBeVisible({ timeout: 30_000 })
    if (await page.getByTestId('guide-done').isVisible()) return
    const before = await where(page)
    const step = (await page.getByTestId('guide-step').textContent())!.trim()
    await page.keyboard.press(stepKey(step))
    await expect.poll(() => where(page), { timeout: 15_000 }).not.toBe(before)
  }
}

test('Guide me after a scramble: following every shown step solves the cube', async ({ page }) => {
  test.setTimeout(150_000)
  await open(page)
  await scrambleThenGuide(page)
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')
  // The arrow on the cube points at the shown step.
  const step = (await page.getByTestId('guide-step').textContent())!.trim()
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-guide-move', step)

  await followToTheEnd(page)
  await expect(page.getByTestId('guide-done')).toBeVisible()
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')
})

test('a wrong move re-solves from where the cube really is, and the guide still finishes', async ({ page }) => {
  test.setTimeout(150_000)
  await open(page)
  await scrambleThenGuide(page)

  const step = (await page.getByTestId('guide-step').textContent())!.trim()
  await page.keyboard.press(oppositeKey(step))
  await expect(page.getByTestId('guide-step')).toBeVisible({ timeout: 30_000 })

  await followToTheEnd(page)
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')
})

test('Scramble alone does not open the guide -- you solve it yourself by default', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Scramble', exact: true }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled', { timeout: 30_000 })
  await expect(page.getByTestId('guide-me')).toBeEnabled({ timeout: 30_000 })
  await page.waitForTimeout(1500)
  await expect(page.getByTestId('guide-panel')).toHaveCount(0)
})

test('Stop, Guide me, and Reset', async ({ page }) => {
  await open(page)
  await scrambleThenGuide(page)
  await page.getByTestId('guide-stop').click()
  await expect(page.getByTestId('guide-panel')).toHaveCount(0)
  await page.getByTestId('guide-me').click()
  await expect(page.getByTestId('guide-step')).toBeVisible({ timeout: 30_000 })
  // Take the guide's first step, then Reset: back to the scramble, guide closed.
  await page.keyboard.press(stepKey((await page.getByTestId('guide-step').textContent())!))
  await expect(page.getByTestId('move-count')).toHaveText('1 moves')
  await page.getByRole('button', { name: /reset/i }).click()
  await expect(page.getByTestId('guide-panel')).toHaveCount(0)
  await expect(page.getByTestId('move-count')).toHaveText('0 moves')
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')
})
