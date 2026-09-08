/**
 * Module hooks that stand in for Next's runtime subpaths.
 *
 * `next/navigation`, `next/server`, `next/link` and `next/router` are not
 * resolvable by plain Node outside a Next build, so loading the bundles to
 * check they *load* needs them stubbed. Nothing is called — the point is to
 * prove every entry point resolves, evaluates and exports what it claims.
 */
const STUBS = new Set(['next/navigation', 'next/server', 'next/link', 'next/router'])

export function resolve(specifier, context, next) {
  if (STUBS.has(specifier)) {
    return { url: `stub:${specifier}`, shortCircuit: true, format: 'module' }
  }
  return next(specifier, context)
}

export function load(url, context, next) {
  if (url.startsWith('stub:')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: `
        const noop = () => {}
        const stub = new Proxy(function () {}, {
          get: (_t, key) => (key === 'then' ? undefined : stub),
          apply: () => stub,
          construct: () => stub,
        })
        export const useRouter = () => ({ push: noop, replace: noop, back: noop, pathname: '/', query: {} })
        export const usePathname = () => '/'
        export const useSearchParams = () => new URLSearchParams()
        export const NextResponse = { next: () => stub, redirect: () => stub }
        export default stub
      `,
    }
  }
  return next(url, context)
}
