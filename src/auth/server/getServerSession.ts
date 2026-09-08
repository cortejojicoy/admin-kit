import type { AdminConfig, AdminServerConfig } from '../../config/types'
import type { AuthSession, AuthUser } from '../types'
import { verifyJWT } from './verifyJWT'
import { parseCookies } from './cookies'

const DEFAULT_COOKIE = 'admin_kit_token'

export interface ServerSessionOptions {
  serverConfig?: AdminServerConfig
  /** HMAC secret, if not supplied through `serverConfig`. */
  secret?: string
  algorithms?: string[]
}

export type RequestLike = Request | { headers: Headers | { cookie?: string | null } }

/**
 * Read and verify the session on the server.
 *
 * Works in App Router server components and route handlers (pass the `Request`),
 * and in `getServerSideProps` (pass `{ headers: req.headers }`).
 *
 * The secret comes from `AdminServerConfig` — a separate object in a separate
 * file that client components never import. `config.auth.jwt.secret` is still
 * read as a deprecated fallback.
 */
export async function getServerSession(
  config: AdminConfig,
  req: RequestLike,
  options: ServerSessionOptions = {},
): Promise<AuthSession | null> {
  if (config.auth.provider === 'jwt') {
    const jwt = config.auth.jwt
    const secret = options.secret ?? options.serverConfig?.jwt?.secret ?? jwt?.secret
    if (!secret) {
      throw new Error(
        'A JWT secret is required for getServerSession(). Pass it via ' +
          '`{ serverConfig }` or `{ secret }` — keep it out of the config object ' +
          'that client components import.',
      )
    }

    const cookieName = options.serverConfig?.jwt?.cookieName ?? jwt?.cookieName ?? DEFAULT_COOKIE
    const token = parseCookies(getCookieHeader(req))[cookieName]
    if (!token) return null

    const result = await verifyJWT(token, secret, {
      algorithms: options.algorithms ?? options.serverConfig?.jwt?.algorithms,
    })
    if (!result.valid || !result.payload) return null

    const mapUser = jwt?.mapUser ?? ((raw: unknown) => raw as AuthUser)
    return {
      user: mapUser(result.payload),
      accessToken: token,
      expiresAt: result.payload.exp,
    }
  }

  if (config.auth.provider === 'custom' && config.auth.custom?.getSession) {
    return config.auth.custom.getSession()
  }

  // OAuth: the session lives in the consumer's own callback/session store, and
  // there is no token here to verify without it.
  return null
}

/** Roles from a session, using the configured field. */
export function rolesFromSession(config: AdminConfig, session: AuthSession | null): string[] {
  if (!session?.user) return []
  const raw = session.user[config.auth.rolesField ?? 'roles']
  return Array.isArray(raw) ? raw.map(String) : []
}

function getCookieHeader(req: RequestLike): string | null {
  const headers = req.headers
  if (typeof (headers as Headers).get === 'function') return (headers as Headers).get('cookie')
  return (headers as { cookie?: string | null }).cookie ?? null
}
