/** CommonJS counterpart to next-stubs.mjs — see the note there. */
const noop = () => {}
const stub = new Proxy(function () {}, {
  get: (_target, key) => (key === 'then' ? undefined : stub),
  apply: () => stub,
  construct: () => stub,
})
module.exports = stub
module.exports.useRouter = () => ({ push: noop, replace: noop, back: noop, pathname: '/', query: {} })
module.exports.usePathname = () => '/'
module.exports.useSearchParams = () => new URLSearchParams()
module.exports.NextResponse = { next: () => stub, redirect: () => stub }
module.exports.default = stub
