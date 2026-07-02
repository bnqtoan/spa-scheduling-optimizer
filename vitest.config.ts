import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts because that one sets root to src/client
// (the SPA build root) — vitest needs the repo root so it can find
// src/server/**/*.test.ts too.
export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
  },
})
