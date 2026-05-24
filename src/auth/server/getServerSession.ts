import type { AdminConfig } from '../../config/types'
import type { AuthSession, AuthUser } from '../types'
import { verifyJWT } from './verifyJWT'
import { parseCookies } from './cookies'

const DEFAULT_COOKIE = 'admin_kit_token'

/**
 * Server-side session reader. Usable in:
 *   - App Router server components (pass `headers()` cookie via `req`)
 *   - Route Handlers (pass the Request)
 *   - getServerSideProps (build a Request-like from req.headers.cookie)
 *
 * For JWT, this verifies the token with config.auth.jwt.secret.
 * For OAuth/custom, this calls config.auth.custom.getSession() if available,
 * otherwise returns null (consumer should implement their own).
 */
export async function getServerSession(
  config: AdminConfig,
  req: Request | { headers: { cookie?: string | null } | Headers },
): Promise<AuthSession | null> {
  if (config.auth.provider === 'jwt') {
    const jwt = config.auth.jwt
    if (!jwt?.secret) {
      throw new Error('config.auth.jwt.secret is required for getServerSession()')
    }
    const cookieHeader = getCookieHeader(req)
    const cookieName = jwt.cookieName ?? DEFAULT_COOKIE
    const token = parseCookies(cookieHeader)[cookieName]
    if (!token) return null
    const result = await verifyJWT(token, jwt.secret)
    if (!result.valid || !result.payload) return null
    const mapUser = jwt.mapUser ?? ((raw: unknown) => raw as AuthUser)
    return {
      user: mapUser(result.payload),
      accessToken: token,
      expiresAt: result.payload.exp,
    }
  }

  if (config.auth.provider === 'custom' && config.auth.custom?.getSession) {
    return config.auth.custom.getSession()
  }

  // OAuth: consumer must implement their own callback/session API; we have
  // no token to verify here without server state.
  return null
}

function getCookieHeader(req: Request | { headers: { cookie?: string | null } | Headers }): string | null {
  const headers = req.headers
  if (headers instanceof Headers) return headers.get('cookie')
  return (headers as { cookie?: string | null }).cookie ?? null
}
