import type { AuthProvider, AuthSession, AuthUser, JWTAuthConfig, TokenStorage } from '../types'

const DEFAULT_COOKIE = 'admin_kit_token'
const DEFAULT_HEADER = { name: 'Authorization', prefix: 'Bearer ' }

let memoryToken: string | null = null

function storageOf(cfg: JWTAuthConfig): TokenStorage {
  return cfg.tokenStorage ?? 'server-cookie'
}

/**
 * Read the token, when the client is allowed to have it at all.
 *
 * `server-cookie` returns `null` by design: the token is in an `HttpOnly`
 * cookie, so there is nothing for script to read and nothing for an injected
 * script to steal. Requests carry it automatically via `credentials: 'include'`.
 */
function readToken(cfg: JWTAuthConfig): string | null {
  if (typeof window === 'undefined') return null
  const name = cfg.cookieName ?? DEFAULT_COOKIE
  switch (storageOf(cfg)) {
    case 'server-cookie':
      return null
    case 'localStorage':
      return window.localStorage.getItem(name)
    case 'memory':
      return memoryToken
    case 'js-cookie': {
      const match = document.cookie.match(new RegExp('(?:^|; )' + escapeRe(name) + '=([^;]*)'))
      return match ? decodeURIComponent(match[1]) : null
    }
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function writeToken(cfg: JWTAuthConfig, token: string | null) {
  if (typeof window === 'undefined') return
  const name = cfg.cookieName ?? DEFAULT_COOKIE
  switch (storageOf(cfg)) {
    case 'server-cookie':
      // The login/logout routes own the cookie. Writing it here would replace an
      // HttpOnly cookie with a script-readable one, which is the exact exposure
      // this mode exists to avoid.
      return
    case 'localStorage':
      if (token) window.localStorage.setItem(name, token)
      else window.localStorage.removeItem(name)
      return
    case 'memory':
      memoryToken = token
      return
    case 'js-cookie': {
      const secure = window.location.protocol === 'https:' ? '; Secure' : ''
      if (token) {
        document.cookie = `${name}=${encodeURIComponent(token)}; Path=/; SameSite=Lax${secure}`
      } else {
        document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
      }
    }
  }
}

function authHeader(cfg: JWTAuthConfig, token: string | null): Record<string, string> {
  if (!token) return {}
  const h = cfg.header ?? DEFAULT_HEADER
  return { [h.name]: `${h.prefix ?? ''}${token}` }
}

export function createJWTProvider(cfg: JWTAuthConfig): AuthProvider {
  const mapUser = cfg.mapUser ?? defaultMapUser
  const mapTokens =
    cfg.mapTokens ??
    ((raw: unknown) => {
      const r = raw as { accessToken?: string; token?: string; access_token?: string; refreshToken?: string; expiresAt?: number }
      return {
        accessToken: r.accessToken ?? r.token ?? r.access_token,
        refreshToken: r.refreshToken,
        expiresAt: r.expiresAt,
      }
    })

  const serverCookie = storageOf(cfg) === 'server-cookie'

  async function getSession(): Promise<AuthSession | null> {
    const token = readToken(cfg)
    // With a script-readable store, no token means no session and there is no
    // point spending a request to confirm it. With an HttpOnly cookie we cannot
    // tell without asking.
    if (!token && !serverCookie) return null

    const res = await fetch(cfg.endpoints.me, {
      credentials: 'include',
      headers: { Accept: 'application/json', ...authHeader(cfg, token) },
    })
    if (!res.ok) return null
    const raw = await res.json().catch(() => null)
    if (raw == null) return null
    return { user: mapUser(raw), ...(token ? { accessToken: token } : {}) }
  }

  return {
    name: 'jwt',
    async login(credentials) {
      const res = await fetch(cfg.endpoints.login, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(credentials),
      })
      if (!res.ok) throw new Error(await errorMessage(res))

      const raw = await res.json().catch(() => ({}))
      const tokens = mapTokens(raw)
      if (tokens.accessToken) writeToken(cfg, tokens.accessToken)

      const session = await getSession()
      if (!session) {
        throw new Error(
          serverCookie
            ? 'Login succeeded but no session cookie was set. Does the login route send Set-Cookie?'
            : 'Login succeeded but no session could be established.',
        )
      }
      return { ...session, ...tokens }
    },

    async logout() {
      const token = readToken(cfg)
      if (cfg.endpoints.logout) {
        await fetch(cfg.endpoints.logout, {
          method: 'POST',
          credentials: 'include',
          headers: { ...authHeader(cfg, token) },
        }).catch(() => undefined)
      }
      writeToken(cfg, null)
    },

    getSession,

    refresh: cfg.endpoints.refresh
      ? async () => {
          const token = readToken(cfg)
          const res = await fetch(cfg.endpoints.refresh!, {
            method: 'POST',
            credentials: 'include',
            headers: { ...authHeader(cfg, token) },
          })
          if (!res.ok) return null
          const raw = await res.json().catch(() => ({}))
          const tokens = mapTokens(raw)
          if (tokens.accessToken) writeToken(cfg, tokens.accessToken)
          return getSession()
        }
      : undefined,
  }
}

/**
 * Unwrap the common `/me` envelopes before assuming the body *is* the user.
 * Backends return the user bare, under `user`, or under `data` about equally
 * often; guessing wrong yields a user object with no id and a blank shell.
 */
function defaultMapUser(raw: unknown): AuthUser {
  const o = raw as Record<string, unknown> | null
  if (o && typeof o === 'object') {
    if (o.user && typeof o.user === 'object') return o.user as AuthUser
    if (o.data && typeof o.data === 'object' && !Array.isArray(o.data)) return o.data as AuthUser
  }
  return raw as AuthUser
}

async function errorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  if (!text) return `Login failed (${res.status})`
  try {
    const body = JSON.parse(text) as Record<string, unknown>
    const msg = body.message ?? body.error ?? body.detail
    if (typeof msg === 'string' && msg) return msg
  } catch {
    // Not JSON — fall through to the raw text.
  }
  return text.slice(0, 300)
}
