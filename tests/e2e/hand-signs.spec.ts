import { expect, test, type Page } from '@playwright/test'

// Drives the REAL app with synthetic hand-landmark frames through the
// dev-only injection seam in useHandGestures (there is no camera in CI).
// Everything after MediaPipe's detection -- the sign recognizer, the fist
// lock, the animated move queue, the renderer -- runs exactly as it does live.

type Real = 'Right' | 'Left'
type HandSpec = { pose: string; real: Real; cx: number }

async function openHands(page: Page) {
  await page.goto('/play/cube3')
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
  await page.getByTestId('input-mode-hands').click()
  await page.waitForFunction(
    () => typeof (globalThis as never as { __cubepalmInjectFrame?: unknown }).__cubepalmInjectFrame === 'function',
  )
  await expect(page.getByTestId('hands-help')).toBeVisible()
}

// Feeds `count` frames of the given hands, one by one with a real gap, so
// React renders (and the recognizer sees) every frame.
async function show(page: Page, hands: HandSpec[], count: number) {
  await page.evaluate(
    async ({ hands, count }) => {
      const inject = (globalThis as never as { __cubepalmInjectFrame: (f: unknown) => void }).__cubepalmInjectFrame
      const t0 = performance.now()
      for (let i = 0; i < count; i++) {
        const frameHands = hands.map((h) => {
          const s = 0.06
          const at = (x: number, y: number) => ({ x: h.cx + x * s, y: 0.5 + y * s, z: 0 })
          const lm = Array.from({ length: 21 }, () => at(0, 0))
          lm[0] = at(0, 1)
          const xs = [-0.3, -0.1, 0.1, 0.3]
          ;[5, 9, 13, 17].forEach((idx, k) => (lm[idx] = at(xs[k], 0)))
          ;[8, 12, 16, 20].forEach((idx, k) => (lm[idx] = h.pose[k] === '1' ? at(xs[k] * 1.2, -1) : at(xs[k], 0.4)))
          lm[4] = at(-0.6, 0.5)
          // MediaPipe labels hands with the user's real hand.
          return { landmarks: lm, handedness: h.real, score: 0.95 }
        })
        inject({ hands: frameHands, timestampMs: t0 + i * 40 })
        await new Promise((r) => setTimeout(r, 40))
      }
    },
    { hands, count },
  )
}

const HOLD = 22 // ~0.9s at 40ms/frame: past the 550ms hold
const R = (pose: string): HandSpec => ({ pose, real: 'Right', cx: 0.35 })
const L = (pose: string): HandSpec => ({ pose, real: 'Left', cx: 0.65 })

test('right hand, index finger, held: exactly R (clockwise)', async ({ page }) => {
  await openHands(page)
  await show(page, [R('1000')], 8)
  await expect(page.getByTestId('sign-hud')).toContainText('R')
  await show(page, [R('1000')], HOLD)
  await expect(page.getByTestId('move-count')).toHaveText('1 moves')
  await page.keyboard.press('Shift+R')
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')
})

test("left hand, same sign: exactly R' (counter-clockwise)", async ({ page }) => {
  await openHands(page)
  await show(page, [L('1000')], HOLD)
  await expect(page.getByTestId('move-count')).toHaveText('1 moves')
  await page.keyboard.press('r')
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')
})

test("U and U' are both reachable: right hand U, then left hand U' undoes it", async ({ page }) => {
  await openHands(page)
  await show(page, [R('1100')], HOLD)
  await expect(page.getByTestId('move-count')).toHaveText('1 moves')
  await show(page, [], 4)
  await show(page, [L('1100')], HOLD)
  await expect(page.getByTestId('move-count')).toHaveText('2 moves')
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')
})

test('both hands at once: two different turns', async ({ page }) => {
  await openHands(page)
  await show(page, [R('1000'), L('0001')], HOLD)
  await expect(page.getByTestId('move-count')).toHaveText('2 moves')
})

test('holding a sign longer turns once; relax and sign again for a second turn', async ({ page }) => {
  await openHands(page)
  await show(page, [R('1110')], HOLD * 2)
  await expect(page.getByTestId('move-count')).toHaveText('1 moves')
  await show(page, [R('1111')], 8)
  await show(page, [R('1110')], HOLD)
  await expect(page.getByTestId('move-count')).toHaveText('2 moves')
})

test('a brief sign turns nothing', async ({ page }) => {
  await openHands(page)
  await show(page, [R('0110')], 10)
  await expect(page.getByTestId('sign-hud')).toBeVisible()
  await show(page, [], 4)
  await expect(page.getByTestId('move-count')).toHaveText('0 moves')
})

test('holding a closed fist still toggles the view lock', async ({ page }) => {
  await openHands(page)
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-camera-locked', 'false')
  await show(page, [R('0000')], 28)
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-camera-locked', 'true')
  await expect(page.getByTestId('move-count')).toHaveText('0 moves')
})
