/**
 * Edge-safe middleware factory. Mount in the consumer's `middleware.ts`:
 *
 *   // middleware.ts (consumer)
 *   import { createAdminMiddleware } from '@kukux/admin-kit/middleware'
 *   import { adminConfig } from './admin.config'
 *
 *   export default createAdminMiddleware(adminConfig)
 *   export const config = { matcher: ['/((?!_next|api/auth|favicon).*)'] }
 *
 * Keep this file free of React / DOM / Node-only deps.
 */
import type { AdminConfig } from './config/types'
import { verifyJWT } from './auth/server/verifyJWT'
import { parseCookies } from './auth/server/cookies'

const DEFAULT_COOKIE = 'admin_kit_token'

export interface AdminMiddlewareOptions {
  /** Override token verification (e.g., RS256 with `jose`). */
  verify?: (token: string) => Promise<{ valid: boolean }>
  /** Extra public routes that bypass auth. Merged with config.auth.publicRoutes. */
  publicRoutes?: string[]
}

type MiddlewareHandler = (req: Request) => Response | Promise<Response>

export function createAdminMiddleware(
  config: AdminConfig,
  opts: AdminMiddlewareOptions = {},
): MiddlewareHandler {
  const publicRoutes = [
    ...(config.auth.publicRoutes ?? ['/login', '/api/auth']),
    ...(opts.publicRoutes ?? []),
  ]
  const loginPath = config.auth.loginPage?.path ?? '/login'
  const cookieName = config.auth.jwt?.cookieName ?? DEFAULT_COOKIE
  const secret = config.auth.jwt?.secret
  const verify =
    opts.verify ??
    (secret
      ? async (token: string) => {
          const r = await verifyJWT(token, secret)
          return { valid: r.valid }
        }
      : undefined)

  return async function adminMiddleware(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const pathname = url.pathname

    if (publicRoutes.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
      return passthrough()
    }

    const token = parseCookies(req.headers.get('cookie'))[cookieName]
    if (!token) return redirectToLogin(url, pathname, loginPath)

    if (verify) {
      const { valid } = await verify(token)
      if (!valid) return redirectToLogin(url, pathname, loginPath)
    }
    // If no verifier is configured (oauth/custom), trust the cookie's existence
    // and let server helpers / API routes do the real check.
    return passthrough()
  }
}

function passthrough(): Response {
  // Returning a non-redirect Response with no body and 200 acts as a passthrough
  // in Next middleware semantics when used via NextResponse. The expected pattern
  // is for consumers to wrap this with NextResponse.next() if they need the
  // typed return. We return a plain Response that next() can interpret.
  return new Response(null, { status: 200 })
}

function redirectToLogin(url: URL, pathname: string, loginPath: string): Response {
  const target = new URL(loginPath, url.origin)
  target.searchParams.set('next', pathname)
  return Response.redirect(target.toString(), 307)
}
