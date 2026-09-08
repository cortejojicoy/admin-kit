import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Node by default — most of this package is pure logic. Component tests opt
    // into jsdom with a `@vitest-environment jsdom` docblock, which keeps the
    // fast majority fast.
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
})
