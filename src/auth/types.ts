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

export interface JWTAuthConfig {
  endpoints: JWTEndpoints
  /** Where the token is stored on the client. Default: 'cookie'. */
  tokenStorage?: 'cookie' | 'localStorage' | 'memory'
  cookieName?: string
  /** Used by middleware/server helpers to verify tokens. NEVER ship to the client. */
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
