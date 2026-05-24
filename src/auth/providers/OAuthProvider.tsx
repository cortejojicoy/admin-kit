import type { AuthProvider, AuthSession, OAuthConfig } from '../types'

/**
 * Client-side OAuth provider. Performs the redirect dance; the actual
 * token exchange must happen in a server route handler that the consumer
 * mounts (see `auth/server/oauth.ts` if implemented).
 *
 * After the server completes the callback and sets a session cookie,
 * `getSession()` reads it via the consumer-provided `/api/auth/session` endpoint.
 */
export function createOAuthProvider(cfg: OAuthConfig): AuthProvider {
  const callbackPath = cfg.callbackPath ?? '/api/auth/callback'

  function startAuthorize(providerId: string) {
    if (typeof window === 'undefined') return
    const p = cfg.providers.find((x) => x.id === providerId)
    if (!p) throw new Error(`Unknown OAuth provider: ${providerId}`)
    const url = new URL(p.authorizationUrl)
    url.searchParams.set('client_id', p.clientId)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set(
      'redirect_uri',
      p.redirectUri ?? `${window.location.origin}${callbackPath}/${p.id}`,
    )
    if (p.scopes?.length) url.searchParams.set('scope', p.scopes.join(' '))
    url.searchParams.set('state', crypto.randomUUID())
    window.location.assign(url.toString())
  }

  async function getSession(): Promise<AuthSession | null> {
    const res = await fetch('/api/auth/session', { credentials: 'include' })
    if (!res.ok) return null
    const raw = (await res.json()) as Partial<AuthSession> | null
    if (!raw?.user) return null
    return raw as AuthSession
  }

  return {
    name: 'oauth',
    async login(credentials) {
      const providerId = (credentials as { provider?: string }).provider ?? cfg.providers[0]?.id
      if (!providerId) throw new Error('No OAuth provider configured')
      startAuthorize(providerId)
      // Browser navigates away — return a never-resolving promise so callers
      // don't show success/failure before the redirect happens.
      return new Promise<AuthSession>(() => undefined)
    },
    async logout() {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined)
    },
    getSession,
  }
}
