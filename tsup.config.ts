import { defineConfig } from 'tsup'

/**
 * Multi-entry build. Each entry maps to a package.json sub-path export.
 * "use client" directives live in the source files themselves; tsup preserves
 * them when bundling, so client.ts modules ship the directive while server.ts
 * and middleware.ts do not.
 */
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    client: 'src/client.ts',
    server: 'src/server.ts',
    middleware: 'src/middleware.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: ['react', 'react-dom', 'next', 'next/link', 'next/router', 'next/navigation'],
})
