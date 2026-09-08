import { defineConfig } from 'tsup'
import type { Format } from 'tsup'

/**
 * Two build passes, because the two halves of the package need different
 * treatment:
 *
 *   - Client entries must carry a `"use client"` directive. esbuild *drops*
 *     directives when it bundles, so preserving the ones in source does not
 *     work (v0.1.8 shipped `dist/client.js` with no directive at all, which
 *     broke every App Router consumer). The banner below puts it back.
 *   - Server/edge/node entries must NOT have that banner, or importing them
 *     from a server component would pull them into the client graph.
 *
 * `outExtension` is pinned so the emitted filenames match the `exports` map in
 * package.json exactly: `.js` for ESM, `.cjs` for CJS. v0.1.8 pointed `import`
 * at `dist/index.mjs`, which tsup never emitted.
 */
const shared = {
  format: ['esm', 'cjs'] satisfies Format[] as Format[],
  dts: true,
  sourcemap: true,
  splitting: false,
  target: 'es2022' as const,
  outExtension({ format }: { format: string }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' }
  },
  external: [
    'react',
    'react-dom',
    'next',
    'next/link',
    'next/router',
    'next/navigation',
    'next/server',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'jiti',
  ],
}

export default defineConfig([
  {
    ...shared,
    entry: { index: 'src/index.ts' },
    treeshake: true,
    clean: true,
  },
  {
    ...shared,
    entry: {
      client: 'src/client.ts',
      data: 'src/data.ts',
      access: 'src/access.ts',
      ui: 'src/ui.ts',
    },
    // `splitting: true` is REQUIRED here, not an optimization.
    //
    // These four entries share the React contexts (`AdminConfigContext`,
    // `AccessContext`, `DataProviderContext`, …). Bundled separately, each
    // entry gets its own copy of the module — so `<AdminProvider>` from
    // `/client` writes to one context object while `<AdminShell>` from `/ui`
    // reads a different one, and every consumer hook throws
    // "must be used inside <AdminProvider>" at runtime. Splitting hoists the
    // shared modules into common chunks so the contexts are singletons.
    //
    // Also note: no `treeshake`. tsup implements it by re-bundling the esbuild
    // output through rollup, which discards esbuild's banner — and the banner
    // is the directive below. Shipping a client entry without "use client"
    // breaks every App Router build.
    splitting: true,
    banner: { js: '"use client";' },
  },
  {
    ...shared,
    entry: {
      server: 'src/server.ts',
      middleware: 'src/middleware.ts',
    },
  },
  {
    ...shared,
    entry: { cli: 'src/cli/bin.ts' },
    dts: false,
    format: ['esm'],
    banner: { js: '#!/usr/bin/env node' },
  },
])
