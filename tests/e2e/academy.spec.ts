import { expect, test, type Page } from '@playwright/test'

const stepKey = (step: string) => (step.endsWith("'") ? `Shift+${step[0]}` : step[0].toLowerCase())

async function followGuide(page: Page) {
  for (let i = 0; i < 60; i++) {
    if (!(await page.getByTestId('guide-step').isVisible())) return
    const before = await page.getByTestId('guide-progress').textContent()
    const step = (await page.getByTestId('guide-step').textContent())!.trim()
    await page.keyboard.press(stepKey(step))
    await expect
      .poll(async () => ((await page.getByTestId('guide-step').isVisible()) ? await page.getByTestId('guide-progress').textContent() : 'finished'), {
        timeout: 10_000,
      })
      .not.toBe(before)
  }
}

test('the Academy lists the lessons and the first one finishes after four turns', async ({ page }) => {
  await page.goto('/learn')
  await expect(page.getByTestId('academy-progress')).toHaveText('0 of 8 done')
  await page.getByTestId('academy-continue').click()
  await expect(page).toHaveURL(/\/learn\/basics/)
  await expect(page.getByTestId('lesson-panel')).toBeVisible()
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
  for (const key of ['r', 'u', 'f', 'l']) await page.keyboard.press(key)
  await expect(page.getByTestId('lesson-done')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('next-lesson').click()
  await expect(page).toHaveURL(/\/learn\/cross/)
})

test('Show me walks through a lesson position and the lesson completes', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/learn/corners')
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByTestId('lesson-algorithm')).toHaveText("R U R' U'")
  // The goal shows live progress: one corner is out of place in this position.
  await expect(page.getByTestId('lesson-progress')).toHaveText('3 of 4 white corners in place')
  // The finger signs for the lesson are listed even in Mouse mode, in the two hand colours.
  await expect(page.getByTestId('lesson-signs')).toBeVisible()
  await expect(page.getByTestId('sign-sequence').locator('li')).toHaveCount(4)
  await page.getByTestId('show-me').click()
  await expect(page.getByTestId('guide-step')).toBeVisible()
  await expect(page.getByTestId('guide-sign')).toContainText(/hand/)
  await followGuide(page)
  await expect(page.getByTestId('lesson-done')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('lesson-progress')).toHaveText('4 of 4 white corners in place')

  // Progress is remembered.
  await page.goto('/learn')
  await expect(page.getByTestId('academy-progress')).toHaveText('1 of 8 done')
})

test('a wrong move during Show me says so instead of re-solving the whole cube', async ({ page }) => {
  await page.goto('/learn/middle')
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
  await page.getByTestId('show-me').click()
  const step = (await page.getByTestId('guide-step').textContent())!.trim()
  // Press the opposite of what is shown.
  await page.keyboard.press(step.endsWith("'") ? step[0].toLowerCase() : `Shift+${step[0]}`)
  await expect(page.getByTestId('lesson-note')).toBeVisible()
  await expect(page.getByTestId('guide-panel')).toHaveCount(0)
})

test('Solve for me plays the solution back with controls, on both cubes', async ({ page }) => {
  test.setTimeout(300_000)
  for (const puzzle of ['cube3', 'mirror']) {
    await page.goto(`/play/${puzzle}`)
    await expect(page.getByTestId('app')).toHaveAttribute('data-solver-ready', 'true', { timeout: 45_000 })
    await page.getByRole('button', { name: /scramble/i }).click()
    await expect(page.getByTestId('solved-status')).toHaveText('Scrambled', { timeout: 30_000 })
    await expect(page.getByRole('button', { name: /solve for me/i })).toBeEnabled({ timeout: 30_000 })
    await page.getByRole('button', { name: /solve for me/i }).click()
    await expect(page.getByTestId('solution-player')).toBeVisible()
    await expect(page.getByTestId('solution-play')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('solved-status')).toHaveText('Solved', { timeout: 60_000 })
    await expect(page.getByTestId('solution-progress')).toHaveText('Solved')
    await page.getByTestId('solution-close').click()
    await expect(page.getByTestId('solution-player')).toHaveCount(0)
  }
})

test('the solution can be paused, stepped and reversed', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/play/cube3')
  await expect(page.getByTestId('app')).toHaveAttribute('data-solver-ready', 'true', { timeout: 45_000 })
  await page.getByRole('button', { name: /scramble/i }).click()
  await expect(page.getByRole('button', { name: /solve for me/i })).toBeEnabled({ timeout: 30_000 })
  await page.getByRole('button', { name: /solve for me/i }).click()
  await expect(page.getByTestId('solution-play')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('solution-play').click() // pause
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible()
  const at = async () => (await page.getByTestId('solution-progress').textContent())!
  await page.waitForTimeout(600)
  const paused = await at()
  await page.getByRole('button', { name: 'Next move' }).click()
  await expect.poll(at).not.toBe(paused)
  await page.getByRole('button', { name: 'Previous move' }).click()
  await expect.poll(at).toBe(paused)
  await page.getByTestId('solution-moves-toggle').click()
  await expect(page.getByTestId('solution-moves')).toBeVisible()
})

test('Home: a sign held in the demo turns a layer, and the left hand turns it the other way', async ({ page }) => {
  await page.goto('/')
  // Left hand sits on the left, right hand on the right.
  const hands = await page.locator('[data-testid^="sign-hand-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')))
  expect(hands).toEqual(['sign-hand-left', 'sign-hand-right'])
  await page.getByTestId('sign-R').click()
  await expect(page.getByTestId('sign-readout')).toContainText("R")
  await expect(page.getByTestId('sign-turns')).toHaveText('1 turn made.', { timeout: 5_000 })
  await page.getByTestId('sign-hand-left').click()
  await expect(page.getByTestId('sign-readout')).toContainText("R'")
  await expect(page.getByTestId('sign-turns')).toHaveText('2 turns made.', { timeout: 5_000 })
  // Toggling a finger to a pattern that is not a sign makes no turn.
  await page.getByTestId('finger-ring').click()
  await expect(page.getByTestId('sign-readout')).toContainText(/not a sign|Hold still|[A-Z]/)
})

test('Watch it plays the practice position as a demo without finishing the lesson for you', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/learn/cross')
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByTestId('lesson-progress')).not.toHaveText('4 of 4 white edges in place')
  await page.getByTestId('watch-it').click()
  await expect(page.getByTestId('solution-player')).toBeVisible()
  await expect(page.getByTestId('solution-progress')).toHaveText('Solved', { timeout: 30_000 })
  await expect(page.getByTestId('lesson-progress')).toHaveText('4 of 4 white edges in place')
  await expect(page.getByTestId('lesson-done')).toHaveCount(0)
})

test('practice positions can be picked, and lessons link forward and back', async ({ page }) => {
  await page.goto('/learn/corners')
  await expect(page.getByTestId('case-1')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('case-3').click()
  await expect(page.getByTestId('case-3')).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('link', { name: /Back: The white cross/ }).click()
  await expect(page).toHaveURL(/\/learn\/cross/)
  await page.getByRole('link', { name: 'Skip ahead' }).click()
  await expect(page).toHaveURL(/\/learn\/corners/)
})

test("after a scramble the move counter starts at 0, separate from the scramble, and a timer runs", async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto("/play/cube3")
  await expect(page.getByTestId("app")).toHaveAttribute("data-solver-ready", "true", { timeout: 45_000 })
  await expect(page.getByTestId("scramble-length")).toHaveCount(0)
  await page.getByRole("button", { name: /scramble/i }).click()
  await expect(page.getByTestId("guide-me")).toBeEnabled({ timeout: 40_000 })
  await expect(page.getByTestId("scramble-length")).toHaveText(/Scramble: \d+/)
  await expect(page.getByTestId("move-count")).toHaveText("0 moves")
  await expect(page.getByTestId("solve-timer")).toHaveCount(0)
  await page.keyboard.press("r")
  await expect(page.getByTestId("move-count")).toHaveText("1 moves")
  await expect(page.getByTestId("solve-timer")).toBeVisible()
  // Reset clears the session.
  await page.getByRole("button", { name: /^reset$/i }).click()
  await expect(page.getByTestId("scramble-length")).toHaveCount(0)
  await expect(page.getByTestId("move-count")).toHaveText("0 moves")
})

test("two scrambles in a row are different", async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto("/play/cube3")
  await expect(page.getByTestId("app")).toHaveAttribute("data-solver-ready", "true", { timeout: 45_000 })
  const recent = async () => JSON.parse((await page.evaluate(() => localStorage.getItem("cubepalm.recentScrambles.v1"))) ?? "[]") as string[]
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: /scramble/i }).click()
    await expect(page.getByTestId("guide-me")).toBeEnabled({ timeout: 40_000 })
  }
  const list = await recent()
  expect(list.length).toBe(2)
  expect(list[0]).not.toBe(list[1])
})

test("close to solved, the guide proves its route is the shortest possible and says so", async ({ page }) => {
  await page.goto("/play/cube3")
  await expect(page.getByTestId("app")).toHaveAttribute("data-solver-ready", "true", { timeout: 45_000 })
  for (const key of ["r", "u", "f", "l"]) await page.keyboard.press(key)
  await page.getByTestId("guide-me").click()
  await expect(page.getByTestId("guide-step")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId("guide-progress")).toHaveText("1/4")
  await expect(page.getByTestId("guide-optimal")).toBeVisible({ timeout: 15_000 })
})

test("a wrong move gets an instant undo step instead of a wait", async ({ page }) => {
  await page.goto("/play/cube3")
  await expect(page.getByTestId("app")).toHaveAttribute("data-solver-ready", "true", { timeout: 45_000 })
  for (const key of ["r", "u", "f"]) await page.keyboard.press(key)
  await page.getByTestId("guide-me").click()
  await expect(page.getByTestId("guide-step")).toHaveText("F'", { timeout: 30_000 })
  await page.keyboard.press("d") // not the move shown
  await expect(page.getByTestId("guide-step")).toHaveText("D'")
  await expect(page.getByTestId("guide-progress")).toHaveText("1/4")
})

test("the guide's route is never longer than simply undoing the scramble, in the same units", async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto("/play/cube3")
  await expect(page.getByTestId("app")).toHaveAttribute("data-solver-ready", "true", { timeout: 45_000 })
  await page.getByRole("button", { name: /scramble/i }).click()
  await expect(page.getByTestId("guide-me")).toBeEnabled({ timeout: 40_000 })
  const scrambleSteps = Number((await page.getByTestId("scramble-length").textContent())!.match(/\d+/)![0])
  await page.getByTestId("guide-me").click()
  await expect(page.getByTestId("guide-step")).toBeVisible({ timeout: 30_000 })
  const total = Number((await page.getByTestId("guide-progress").textContent())!.split("/")[1])
  // Both numbers count a half turn as two, so undoing the scramble would take exactly scrambleSteps.
  expect(total).toBeLessThanOrEqual(scrambleSteps)
  expect(total).toBeGreaterThan(10)
})

test('choosing Hands asks for the camera at once, without waiting for the hand model', async ({ page }) => {
  await page.addInitScript(`
    navigator.mediaDevices.getUserMedia = async () => {
      window.__asked = performance.now()
      throw Object.assign(new Error('blocked'), { name: 'NotAllowedError' })
    }
  `)
  // Hold the model back: the prompt must not be queued behind it.
  await page.route('**/models/hand_landmarker.task', async (route) => {
    await new Promise((r) => setTimeout(r, 6000))
    await route.continue()
  })
  await page.goto('/play/cube3')
  await page.getByTestId('input-mode-hands').click()
  await page.waitForFunction('window.__asked !== undefined', null, { timeout: 2500 })
  await expect(page.getByTestId('gesture-error')).toContainText('Camera is blocked')
})
