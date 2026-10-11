import { defineConfig } from 'vitest/config'

// The experiments in research/ are run by Vitest because it already knows how
// to load this project's TypeScript: `npm run research`. They are not tests
// (nothing in the app depends on them passing), so they have their own config
// and are excluded from `npm test`. Each one writes a table to docs/research/.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['research/**/*.study.ts'],
    // An experiment may run for minutes; a test may not.
    testTimeout: 30 * 60_000,
    // One at a time: several of them time the solver, and timings taken while
    // another experiment is using the processor would mean nothing.
    fileParallelism: false,
  },
})
