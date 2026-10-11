import react from '@vitejs/plugin-react'
// defineConfig comes from "vitest/config", not "vite" -- the plain vite export
// has no `test` key and fails to typecheck.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    // Node, not jsdom, is the default: nearly every test here is pure logic, and
    // cubing's scrambler spawns a worker that cannot instantiate under jsdom.
    // Component tests opt in per file with a `@vitest-environment jsdom` docblock.
    environment: 'node',
    globals: true,
    // tests/e2e is Playwright's; its *.spec.ts files match vitest's default
    // include glob and blow up under vitest if not excluded here.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**', 'research/**', 'scratchpad/**'],
    testTimeout: 30_000,
  },
})
