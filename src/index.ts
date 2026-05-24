/**
 * Main entry — re-exports the most-used config + type surface.
 * Heavy / runtime-sensitive code is split into sub-paths:
 *   '@kukux/admin-kit/client'     — React components & hooks (use client)
 *   '@kukux/admin-kit/server'     — server-only helpers (getServerSession, verifyJWT)
 *   '@kukux/admin-kit/middleware' — edge-safe middleware factory
 */

export { defineAdminConfig } from './config/defineConfig'
export { resolveConfig, DEFAULT_LOGIN_PATH, DEFAULT_AFTER_LOGIN, DEFAULT_AFTER_LOGOUT } from './config/defaults'

export type {
  AdminConfig,
  ResolvedAdminConfig,
  AuthConfig,
  AppConfig,
  LayoutConfig,
  ThemeConfig,
  LoginPageConfig,
  LoginPageProps,
  RouterFlavor,
} from './config/types'

export type {
  AuthUser,
  AuthSession,
  AuthState,
  AuthStatus,
  AuthActions,
  AuthContextValue,
  AuthProvider,
  JWTAuthConfig,
  JWTEndpoints,
  OAuthConfig,
  OAuthProviderConfig,
} from './auth/types'

export type { NavItem, NavSection } from './navigation/types'
export type { AdminModule } from './modules/types'
