import type { AuthProvider, AuthSession, AuthUser, JWTAuthConfig } from '../types'

const DEFAULT_COOKIE = 'admin_kit_token'
const DEFAULT_HEADER = { name: 'Authorization', prefix: 'Bearer ' }

function readToken(cfg: JWTAuthConfig): string | null {
  if (typeof window === 'undefined') return null
  const storage = cfg.tokenStorage ?? 'cookie'
  const cookieName = cfg.cookieName ?? DEFAULT_COOKIE
  if (storage === 'localStorage') return window.localStorage.getItem(cookieName)
  if (storage === 'memory') return memoryToken
  const match = document.cookie.match(new RegExp('(?:^|; )' + cookieName + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

let memoryToken: string | null = null

function writeToken(cfg: JWTAuthConfig, token: string | null) {
  if (typeof window === 'undefined') return
  const storage = cfg.tokenStorage ?? 'cookie'
  const cookieName = cfg.cookieName ?? DEFAULT_COOKIE
  if (storage === 'localStorage') {
    if (token) window.localStorage.setItem(cookieName, token)
    else window.localStorage.removeItem(cookieName)
    return
  }
  if (storage === 'memory') {
    memoryToken = token
    return
  }
  if (token) {
    document.cookie = `${cookieName}=${encodeURIComponent(token)}; path=/; SameSite=Lax`
  } else {
    document.cookie = `${cookieName}=; path=/; Max-Age=0; SameSite=Lax`
  }
}

function authHeader(cfg: JWTAuthConfig, token: string | null): Record<string, string> {
  if (!token) return {}
  const h = cfg.header ?? DEFAULT_HEADER
  return { [h.name]: `${h.prefix ?? ''}${token}` }
}

export function createJWTProvider(cfg: JWTAuthConfig): AuthProvider {
  const mapUser = cfg.mapUser ?? ((raw: unknown) => raw as AuthUser)
  const mapTokens =
    cfg.mapTokens ??
    ((raw: unknown) => {
      const r = raw as { accessToken?: string; token?: string; refreshToken?: string; expiresAt?: number }
      return {
        accessToken: r.accessToken ?? r.token,
        refreshToken: r.refreshToken,
        expiresAt: r.expiresAt,
      }
    })

  async function getSession(): Promise<AuthSession | null> {
    const token = readToken(cfg)
    if (!token) return null
    const res = await fetch(cfg.endpoints.me, {
      credentials: 'include',
      headers: { ...authHeader(cfg, token) },
    })
    if (!res.ok) return null
    const raw = await res.json()
    return { user: mapUser(raw), accessToken: token }
  }

  return {
    name: 'jwt',
    async login(credentials) {
      const res = await fetch(cfg.endpoints.login, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Login failed (${res.status})`)
      }
      const raw = await res.json()
      const tokens = mapTokens(raw)
      if (tokens.accessToken) writeToken(cfg, tokens.accessToken)
      const session = await getSession()
      if (!session) throw new Error('Could not establish session after login')
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
          const raw = await res.json()
          const tokens = mapTokens(raw)
          if (tokens.accessToken) writeToken(cfg, tokens.accessToken)
          return getSession()
        }
      : undefined,
  }
}
