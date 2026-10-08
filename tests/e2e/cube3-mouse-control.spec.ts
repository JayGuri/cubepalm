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

test('Undo takes back your turns but stops at the scramble; Reset returns to the scramble', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/play/cube3')
  await expect(page.getByTestId('app')).toHaveAttribute('data-solver-ready', 'true', { timeout: 30_000 })
  const undo = page.getByRole('button', { name: 'Undo', exact: true })
  const reset = page.getByRole('button', { name: 'Reset', exact: true })
  const canvas = page.getByTestId('puzzle-canvas')

  await page.getByRole('button', { name: 'Scramble', exact: true }).click()
  await expect(page.getByRole('button', { name: /solve for me/i })).toBeEnabled({ timeout: 60_000 })
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')
  // Fresh from the scramble there is nothing of yours to take back.
  await expect(undo).toBeDisabled()
  await expect(reset).toBeDisabled()
  await page.waitForTimeout(400)
  const scrambled = await canvas.screenshot()

  // Two turns, two undos: back at the scramble, and no further.
  await page.keyboard.press('r')
  await page.keyboard.press('u')
  await expect(page.getByTestId('move-count')).toHaveText('2 moves')
  await undo.click()
  await undo.click()
  await expect(undo).toBeDisabled()
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')
  await page.waitForTimeout(600)
  expect((await canvas.screenshot()).equals(scrambled)).toBe(true)

  // Reset drops every turn at once and lands on the same scrambled cube.
  for (const key of ['f', 'l', 'd']) await page.keyboard.press(key)
  await expect(reset).toBeEnabled()
  await reset.click()
  await expect(page.getByTestId('move-count')).toHaveText('0 moves')
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')
  await expect(reset).toBeDisabled()
  await page.waitForTimeout(600)
  expect((await canvas.screenshot()).equals(scrambled)).toBe(true)
})

test('a scramble of your own: typed, or tapped in, then practised like any other', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/play/cube3')
  await expect(page.getByTestId('app')).toHaveAttribute('data-solver-ready', 'true', { timeout: 30_000 })
  const dialog = page.getByTestId('scramble-dialog')

  // Typed. Letters typed here are text, not turns of the cube behind the dialog.
  await page.getByTestId('custom-scramble').click()
  await expect(dialog).toBeVisible()
  await page.getByTestId('scramble-input').fill('R U x')
  await expect(page.getByTestId('scramble-status')).toContainText('"x" is not a turn')
  await expect(page.getByTestId('scramble-use')).toBeDisabled()
  await page.getByTestId('scramble-input').fill('')
  await page.getByTestId('scramble-input').pressSequentially("R U F'")
  await expect(page.getByTestId('scramble-status')).toHaveText('3 turns.')
  await page.getByTestId('scramble-use').click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')
  await expect(page.getByTestId('scramble-length')).toHaveText('Scramble: 3')
  await expect(page.getByTestId('move-count')).toHaveText('0 moves')
  // It is the start of the attempt, like any scramble: nothing to undo yet.
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
  // Solving it by hand: undo F' with F, then U', then R'.
  await page.keyboard.press('f')
  await page.keyboard.press('Shift+U')
  await page.keyboard.press('Shift+R')
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')
  await expect(page.getByTestId('solve-summary')).toHaveText('your own scramble')

  // Tapped in with the on-screen buttons, starting from what is there.
  await page.getByTestId('custom-scramble').click()
  await expect(page.getByTestId('scramble-input')).toHaveValue("R U F'")
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  const keys = page.getByTestId('scramble-keys')
  await keys.getByRole('button', { name: 'L', exact: true }).click()
  await keys.getByRole('button', { name: 'D2', exact: true }).click()
  await keys.getByRole('button', { name: 'B′', exact: true }).click()
  await keys.getByRole('button', { name: 'R', exact: true }).click()
  await page.getByRole('button', { name: 'Remove last' }).click()
  await expect(page.getByTestId('scramble-input')).toHaveValue("L D2 B'")
  await page.getByTestId('scramble-input').press('Enter')
  await expect(page.getByTestId('scramble-length')).toHaveText('Scramble: 4')

  // Escape leaves things as they were; an empty scramble is a solved cube.
  await page.getByTestId('custom-scramble').click()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByTestId('scramble-length')).toHaveText('Scramble: 4')
  await page.getByTestId('custom-scramble').click()
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await page.getByTestId('scramble-use').click()
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')
  await expect(page.getByTestId('scramble-length')).toHaveCount(0)
})

test('Scramble then Solve returns the cube to solved', async ({ page }) => {
  await page.goto('/play/cube3')
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')

  await page.getByRole('button', { name: 'Scramble', exact: true }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')

  await page.getByRole('button', { name: /solve/i }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Solved', { timeout: 30_000 })
  // A scrambled cube coming back solved gets its moment.
  await expect(page.getByTestId('solved-burst')).toHaveCount(1)
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
  await page.getByRole('button', { name: 'Scramble', exact: true }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')
  await expect(page.getByRole('button', { name: /solve for me/i })).toBeEnabled({ timeout: 60_000 })
  await page.getByRole('button', { name: /solve for me/i }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Solved', { timeout: 60_000 })
})

test('keys pressed while the scramble is being dealt are ignored, not buried in it', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/play/cube3')
  await expect(page.getByTestId('app')).toHaveAttribute('data-solver-ready', 'true', { timeout: 30_000 })
  await page.getByRole('button', { name: 'Scramble', exact: true }).click()
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

test('the scramble can be copied as notation', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/play/cube3')
  await expect(page.getByTestId('app')).toHaveAttribute('data-solver-ready', 'true', { timeout: 30_000 })
  await page.getByRole('button', { name: 'Scramble', exact: true }).click()
  await expect(page.getByRole('button', { name: /solve for me/i })).toBeEnabled({ timeout: 60_000 })
  await page.getByTestId('scramble-length').click()
  await expect(page.getByTestId('scramble-length')).toHaveText('Scramble copied')
  const copied = await page.evaluate('navigator.clipboard.readText()')
  expect(String(copied)).toMatch(/^([URFDLB][2']? ?)+$/)
})

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  test('turn buttons stand in for the keyboard, and the guide lights up the one to tap', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/play/cube3')
    await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
    await expect(page.getByTestId('input-mode-mouse')).toHaveText('Touch')
    const pad = page.getByTestId('move-pad')
    await pad.getByRole('button', { name: 'Turn the R face clockwise' }).tap()
    await expect(page.getByTestId('move-count')).toHaveText('1 moves')
    // The other direction: flip the switch, tap again, and the cube is back.
    await pad.getByRole('button', { name: 'Turn the other way' }).tap()
    await pad.getByRole('button', { name: 'Turn the R face counter-clockwise' }).tap()
    await expect(page.getByTestId('solved-status')).toHaveText('Solved')

    await pad.getByRole('button', { name: 'Turn the other way' }).tap()
    for (const face of ['U', 'F']) await pad.getByRole('button', { name: `Turn the ${face} face clockwise` }).tap()
    await page.getByTestId('guide-me').tap()
    await expect(page.getByTestId('guide-tap')).toBeVisible()
    // Following only the glowing button solves it: F' then U'.
    for (let i = 0; i < 2; i++) {
      const before = await page.getByTestId('guide-progress').textContent().catch(() => null)
      await pad.locator('[data-wanted=true]').tap()
      if (i === 0) await expect(page.getByTestId('guide-progress')).not.toHaveText(before ?? '')
    }
    await expect(page.getByTestId('solved-status')).toHaveText('Solved')
  })
})
