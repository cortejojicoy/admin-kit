/**
 * Import smoke test.
 *
 * The three bugs in v0.1.8 — an `exports` map pointing at files tsup never
 * emitted, a stripped `"use client"` directive, and a middleware that could not
 * pass a request through — all typechecked cleanly and all shipped. This is the
 * cheapest check that would have caught two of them: actually resolve and load
 * every entry point the way a consumer does, in both module systems.
 */
import { createRequire, register } from 'node:module'
import { readFileSync } from 'node:fs'

// Next's runtime subpaths are not resolvable by plain Node; stub them so the
// bundles can be loaded at all. See scripts/next-stubs.mjs.
register('./next-stubs.mjs', import.meta.url)

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

/** Export paths are relative to the package root, not to this script. */
const root = new URL('../', import.meta.url)

// The CJS half needs the same stubs, and loader hooks don't apply to require().
const Module = require('node:module')
const originalResolve = Module._resolveFilename
const CJS_STUBS = new Set(['next/navigation', 'next/server', 'next/link', 'next/router'])
Module._resolveFilename = function (request, ...rest) {
  if (CJS_STUBS.has(request)) return require.resolve('./cjs-stub.cjs')
  return originalResolve.call(this, request, ...rest)
}

const failures = []
const CLIENT_ENTRIES = new Set(['./client', './data', './access', './ui'])

for (const [subpath, target] of Object.entries(pkg.exports)) {
  if (subpath === './package.json' || typeof target === 'string') continue

  const esm = target.import.default
  const cjs = target.require.default

  const specifier = subpath === '.' ? pkg.name : `${pkg.name}/${subpath.slice(2)}`

  // ESM
  try {
    const mod = await import(new URL(esm, root).href)
    if (Object.keys(mod).length === 0) failures.push(`${specifier}: ESM export is empty`)
  } catch (error) {
    failures.push(`${specifier}: ESM import failed — ${error.message}`)
  }

  // CJS
  try {
    const mod = require(new URL(cjs, root).pathname)
    if (Object.keys(mod).length === 0) failures.push(`${specifier}: CJS export is empty`)
  } catch (error) {
    failures.push(`${specifier}: CJS require failed — ${error.message}`)
  }

  // Directive
  const source = readFileSync(new URL(esm, root), 'utf8')
  const hasDirective = /^["']use client["']/.test(source)
  if (CLIENT_ENTRIES.has(subpath) && !hasDirective) {
    failures.push(`${specifier}: missing "use client" directive`)
  }
  if (!CLIENT_ENTRIES.has(subpath) && hasDirective) {
    failures.push(`${specifier}: unexpected "use client" directive on a server entry`)
  }
}

if (failures.length > 0) {
  console.error('Smoke test failed:')
  for (const failure of failures) console.error(`  ✗ ${failure}`)
  process.exit(1)
}

console.log(`Smoke test passed: ${Object.keys(pkg.exports).length - 1} entry points load in ESM and CJS.`)
