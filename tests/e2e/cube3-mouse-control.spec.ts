import { expect, test } from '@playwright/test'

test('home lists the 3x3 and links into free play', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /solve the cube with your hands/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /3.3 Cube/ })).toBeVisible()
  await page.getByTestId('play-cube3').click()
  await expect(page).toHaveURL(/\/play\/cube3/)
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
})

test('dragging a cube face turns it, and Reset restores the solved state', async ({ page }) => {
  await page.goto('/play/cube3')
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')

  const box = (await canvas.boundingBox())!
  // Drag across the upper-right of the cube. This is a smoke test for "a drag
  // produced a real move" -- geometric correctness is covered by the unit tests
  // on moveFromDrag and faceletColors, which do not need a browser.
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.35)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.35, { steps: 12 })
  await page.mouse.up()

  await expect(page.getByTestId('move-count')).not.toHaveText('0 moves')
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')

  await page.getByRole('button', { name: /^reset$/i }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')
  await expect(page.getByTestId('move-count')).toHaveText('0 moves')
})

test('scramble unsolves and undo walks back one move', async ({ page }) => {
  await page.goto('/play/cube3')
  await page.getByRole('button', { name: /scramble/i }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')

  const before = await page.getByTestId('move-count').textContent()
  await page.getByRole('button', { name: /undo/i }).click()
  await expect(page.getByTestId('move-count')).not.toHaveText(before!)
})

test('Scramble then Solve returns the cube to solved', async ({ page }) => {
  await page.goto('/play/cube3')
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')

  await page.getByRole('button', { name: /scramble/i }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')

  await page.getByRole('button', { name: /solve/i }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Solved', { timeout: 30_000 })
})

test('the solver is warmed at startup, not on first Solve press', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('app')).toHaveAttribute('data-solver-ready', 'true', {
    timeout: 30_000,
  })
})

test('with the solver worker blocked, the app falls back and still scrambles and solves', async ({ page }) => {
  test.setTimeout(120_000)
  await page.route('**/kociemba.worker*', (route) => route.abort())
  await page.goto('/play/cube3')
  // Not stuck warming: it says it is answering from the main thread.
  await expect(page.getByTestId('app')).toHaveAttribute('data-solver-state', 'fallback', { timeout: 30_000 })
  await page.getByRole('button', { name: /scramble/i }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')
  await expect(page.getByRole('button', { name: /solve for me/i })).toBeEnabled({ timeout: 60_000 })
  await page.getByRole('button', { name: /solve for me/i }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Solved', { timeout: 60_000 })
})

test('keys pressed while the scramble is being dealt are ignored, not buried in it', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/play/cube3')
  await expect(page.getByTestId('app')).toHaveAttribute('data-solver-ready', 'true', { timeout: 30_000 })
  await page.getByRole('button', { name: /scramble/i }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')
  for (const key of ['r', 'u', 'f']) await page.keyboard.press(key)
  await expect(page.getByRole('button', { name: /solve for me/i })).toBeEnabled({ timeout: 60_000 })
  await expect(page.getByTestId('move-count')).toHaveText('0 moves')
})

test('Reset straight after a turn leaves a solved cube, with nothing landing late', async ({ page }) => {
  await page.goto('/play/cube3')
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
  for (const key of ['r', 'u', 'f', 'r', 'u']) await page.keyboard.press(key)
  await page.getByRole('button', { name: /reset/i }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')
  await page.waitForTimeout(2500)
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')
  await expect(page.getByTestId('move-count')).toHaveText('0 moves')
})

test('on a phone the tips start closed, and the ? button brings them back', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/play/cube3')
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByTestId('mouse-tips')).toHaveCount(0)
  await page.getByTestId('tips-open').click()
  await expect(page.getByTestId('mouse-tips')).toBeVisible()
  await page.getByRole('button', { name: 'Hide tips' }).click()
  await expect(page.getByTestId('mouse-tips')).toHaveCount(0)
  await expect(page.getByTestId('tips-open')).toBeVisible()
})

test('each page sets its own title and canonical address', async ({ page }) => {
  const canonical = () => page.locator('link[rel="canonical"]').getAttribute('href')
  await page.goto('/')
  await expect(page).toHaveTitle(/online Rubik's Cube you solve with hand gestures/)
  await page.goto('/learn/cross')
  await expect(page).toHaveTitle(/lesson 2 of 8/)
  expect(await canonical()).toBe('https://cubepalm.vercel.app/learn/cross')
  await page.goto('/play/mirror')
  await expect(page).toHaveTitle(/Mirror Cube/)
  // Moving between pages inside the app (no reload) updates it too.
  await page.goto('/')
  await page.getByRole('link', { name: 'Learn', exact: true }).click()
  await expect(page).toHaveTitle(/Learn to solve a Rubik's Cube/)
  expect(await canonical()).toBe('https://cubepalm.vercel.app/learn')
})

test('a lost graphics context is rebuilt when the browser gives it back', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/play/cube3')
  const canvas = page.getByTestId('puzzle-canvas')
  await expect(canvas).toHaveAttribute('data-ready', 'true')
  for (const key of ['r', 'u']) await page.keyboard.press(key)
  const lost = await page.evaluate(`(() => {
    const c = document.querySelector('[data-testid="puzzle-canvas"] canvas')
    const gl = c.getContext('webgl2') || c.getContext('webgl')
    const ext = gl.getExtension('WEBGL_lose_context')
    if (!ext) return 'unsupported'
    c.setAttribute('data-before-loss', 'yes')
    window.__ctxEvents = []
    c.addEventListener('webglcontextlost', () => window.__ctxEvents.push('lost'))
    c.addEventListener('webglcontextrestored', () => window.__ctxEvents.push('restored'))
    ext.loseContext()
    setTimeout(() => ext.restoreContext(), 300)
    return 'ok'
  })()`)
  test.skip(lost === 'unsupported', 'this browser cannot simulate a lost context')
  await page.waitForFunction('window.__ctxEvents.includes("restored")', null, { timeout: 15_000 })
  // The scene is rebuilt on a fresh canvas, still showing the turns made, and still turns.
  await expect(canvas).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('canvas[data-before-loss]')).toHaveCount(0)
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')
  await page.keyboard.press('f')
  await expect(page.getByTestId('move-count')).toHaveText('3 moves')
})
