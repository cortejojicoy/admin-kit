import type { ReactNode } from 'react'

export interface AuthUser {
  id: string
  email?: string
  name?: string
  image?: string
  roles?: string[]
  permissions?: string[]
  [key: string]: unknown
}

export interface AuthSession {
  user: AuthUser
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
}

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated'

export interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  session: AuthSession | null
  error: string | null
}

export interface AuthActions {
  login: (credentials: Record<string, unknown>) => Promise<AuthSession>
  logout: () => Promise<void>
  getSession: () => Promise<AuthSession | null>
  refresh?: () => Promise<AuthSession | null>
}

export type AuthContextValue = AuthState &
  AuthActions & {
    isAuthenticated: boolean
    isLoading: boolean
  }

/**
 * AuthProvider is the strategy interface every auth backend implements.
 * Instances are created from config and consumed by <AuthContextProvider>.
 */
export interface AuthProvider {
  readonly name: string
  initialize?: () => Promise<AuthSession | null>
  login: (credentials: Record<string, unknown>) => Promise<AuthSession>
  logout: () => Promise<void>
  getSession: () => Promise<AuthSession | null>
  refresh?: () => Promise<AuthSession | null>
}

/* ---------------- JWT ---------------- */

export interface JWTEndpoints {
  login: string
  me: string
  logout?: string
  refresh?: string
}

/**
 * Where the session token lives.
 *
 *   `server-cookie` (default) — the login route sets an `HttpOnly; Secure`
 *       cookie and the client never touches the token. The only option that is
 *       not readable by injected script, which is why it is the default.
 *   `js-cookie` — the client writes `document.cookie`. Readable by any XSS on
 *       the origin. Opt in only when the token must be read from JS.
 *   `localStorage` — same exposure as `js-cookie`, and invisible to middleware
 *       and to server components, so route protection must be client-side.
 *   `memory` — lost on reload; useful for embedded or test usage.
 */
export type TokenStorage = 'server-cookie' | 'js-cookie' | 'localStorage' | 'memory'

export interface JWTAuthConfig {
  endpoints: JWTEndpoints
  /** Default: `'server-cookie'`. See {@link TokenStorage}. */
  tokenStorage?: TokenStorage
  cookieName?: string
  /**
   * @deprecated Moved to `AdminServerConfig.jwt.secret` in 0.2.0 so it cannot
   * be reached from the module graph a client component imports. Still read as
   * a fallback, and stripped by `serializeConfig()`.
   */
  secret?: string
  /** Header to send on authenticated requests. Default: 'Authorization' with 'Bearer '. */
  header?: { name: string; prefix?: string }
  /** Extract user from /me response. */
  mapUser?: (raw: unknown) => AuthUser
  /** Extract { accessToken, refreshToken?, expiresAt? } from /login response. */
  mapTokens?: (raw: unknown) => Partial<AuthSession>
}

/* ---------------- OAuth ---------------- */

export interface OAuthProviderConfig {
  id: string
  name: string
  authorizationUrl: string
  tokenUrl?: string
  userInfoUrl?: string
  clientId: string
  clientSecret?: string
  scopes?: string[]
  redirectUri?: string
  icon?: ReactNode
  mapUser?: (raw: unknown) => AuthUser
}

export interface OAuthConfig {
  providers: OAuthProviderConfig[]
  callbackUrl?: string
  /** Server-only callback handler path; default '/api/auth/callback/:provider'. */
  callbackPath?: string
}
