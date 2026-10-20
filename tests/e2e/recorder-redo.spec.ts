import { expect, test } from '@playwright/test'

// Chromium's fake camera stands in for a webcam (it shows no hand, which is fine:
// the test is about the recorder's steps, not what it sees).
test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['camera'],
})

test('a shape can be redone while recording, and the one before it afterwards', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/record')
  await page.getByTestId('record-start').click()
  const shape = page.getByTestId('record-step').getByText(/^Shape \d+ of 24$/)
  await expect(shape).toHaveText('Shape 1 of 24')

  // Nothing to go back to on the first shape while getting ready; once recording, it can be redone.
  await expect(page.getByTestId('record-redo')).toHaveCount(0)
  await expect(page.getByTestId('record-phase')).toContainText('Recording', { timeout: 60_000 })
  await page.getByTestId('record-redo').click()
  await expect(page.getByTestId('record-phase')).toContainText('Get ready')
  await expect(shape).toHaveText('Shape 1 of 24')

  // Let shape 1 finish, then step back from shape 2.
  await expect(shape).toHaveText('Shape 2 of 24', { timeout: 30_000 })
  await expect(page.getByTestId('record-phase')).toContainText('Get ready')
  await page.getByTestId('record-redo').click()
  await expect(shape).toHaveText('Shape 1 of 24')
  await expect(page.getByTestId('record-redo')).toHaveCount(0)
})
