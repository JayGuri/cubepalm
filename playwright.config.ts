import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  // Each puzzle now animates real per-frame WebGL rotations (previously
  // moves were an instant colour-swap with no render-loop cost). Several
  // browser instances doing that at once on this sandbox's CPU budget made
  // scramble/solve timing assertions flaky under the default parallel
  // workers -- 17/17 passed reliably at workers: 1, 2-3 failed intermittently
  // at the default. One worker is slower overall but deterministic.
  workers: 1,
  // The cube is drawn by software in a headless browser, which is many times
  // slower than a graphics card and varies a lot between machines. Budgets are
  // generous so a slow machine reads as slow, not as broken; one retry absorbs
  // a stray stall. Logic failures still fail both attempts.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 1,
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: 'http://localhost:5173' },
})
