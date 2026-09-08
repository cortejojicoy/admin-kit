/**
 * Edge middleware factory. Mount it in the consumer's `middleware.ts`:
 *
 *   import { createAdminMiddleware } from '@cortejojicoy/admin-kit/middleware'
 *   import { adminConfig } from './admin.config'
 *
 *   export default createAdminMiddleware(adminConfig, {
 *     secret: process.env.JWT_SECRET,
 *   })
 *   export const config = { matcher: ['/((?!_next|api/auth|favicon).*)'] }
 *
 * ## This is not the authorization boundary
 *
 * Middleware here does one job: send a browser with no usable session to the
 * login page instead of rendering a shell that will fail every request it
 * makes. It is a **UX redirect**, and it must never be the only thing standing
 * between a request and your data. Next's own middleware has been bypassable
 * (CVE-2025-29927), a token can be revoked after it was signed, and for the
 * `oauth`/`custom` providers this file has no way to check anything beyond
 * "a cookie is present".
 *
 * Put the real checks in route handlers and server components:
 * `getServerSession()` then `assertPermission()`. The kit's page generators do.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { AdminConfig, AdminServerConfig } from './config/types'
import { verifyJWT } from './auth/server/verifyJWT'
import { parseCookies } from './auth/server/cookies'

const DEFAULT_COOKIE = 'admin_kit_token'

export interface AdminMiddlewareOptions {
  /** HMAC secret. Prefer this over `config.auth.jwt.secret`, which is deprecated. */
  secret?: string
  /** Accepted algorithms. Default `['HS256']`. */
  algorithms?: string[]
  /** Replace verification entirely — e.g. RS256 via `jose`. */
  verify?: (token: string) => Promise<{ valid: boolean }> | { valid: boolean }
  /** Extra public routes, merged with `config.auth.publicRoutes`. */
  publicRoutes?: string[]
  /** Server config, if you'd rather pass the whole object. */
  serverConfig?: AdminServerConfig
  /** Query param carrying the post-login destination. Default `next`. */
  returnParam?: string
}

export function createAdminMiddleware(config: AdminConfig, opts: AdminMiddlewareOptions = {}) {
  const publicRoutes = [
    ...(config.auth.publicRoutes ?? ['/login', '/api/auth']),
    ...(opts.publicRoutes ?? []),
  ]
  const loginPath = config.auth.loginPage?.path ?? '/login'
  const cookieName =
    opts.serverConfig?.jwt?.cookieName ?? config.auth.jwt?.cookieName ?? DEFAULT_COOKIE
  const secret = opts.secret ?? opts.serverConfig?.jwt?.secret ?? config.auth.jwt?.secret
  const algorithms = opts.algorithms ?? opts.serverConfig?.jwt?.algorithms
  const returnParam = opts.returnParam ?? 'next'

  const verify =
    opts.verify ??
    (secret
      ? async (token: string) => {
          const r = await verifyJWT(token, secret, { algorithms })
          return { valid: r.valid }
        }
      : undefined)

  return async function adminMiddleware(req: NextRequest | Request): Promise<NextResponse> {
    const url = new URL(req.url)
    const { pathname } = url

    if (isPublic(pathname, publicRoutes) || pathname === loginPath) {
      return NextResponse.next()
    }

    const token = parseCookies(req.headers.get('cookie'))[cookieName]
    if (!token) return redirectToLogin(url, pathname, loginPath, returnParam)

    if (verify) {
      const { valid } = await verify(token)
      if (!valid) return redirectToLogin(url, pathname, loginPath, returnParam)
    }
    // No verifier configured (oauth/custom, or no secret): the cookie's mere
    // presence is all this layer can see, and presence is not authentication.
    // The server-side checks are what actually gate the data.
    return NextResponse.next()
  }
}

function isPublic(pathname: string, routes: string[]): boolean {
  return routes.some((p) => pathname === p || pathname.startsWith(p.endsWith('/') ? p : p + '/'))
}

function redirectToLogin(
  url: URL,
  pathname: string,
  loginPath: string,
  returnParam: string,
): NextResponse {
  const target = new URL(loginPath, url.origin)
  const dest = pathname + url.search
  if (dest && dest !== '/') target.searchParams.set(returnParam, dest)
  return NextResponse.redirect(target)
}
