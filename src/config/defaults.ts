import type { ResolvedAdminConfig, AdminConfig } from './types'

export const DEFAULT_LOGIN_PATH = '/login'
export const DEFAULT_AFTER_LOGIN = '/'
export const DEFAULT_AFTER_LOGOUT = '/login'
export const DEFAULT_PUBLIC_ROUTES = ['/login', '/api/auth']

export function resolveConfig(config: AdminConfig): ResolvedAdminConfig {
  return {
    ...config,
    router: config.router ?? 'app',
    auth: {
      ...config.auth,
      loginPage: {
        path: DEFAULT_LOGIN_PATH,
        title: `Sign in to ${config.app.name}`,
        ...config.auth.loginPage,
      },
      afterLoginRedirect: config.auth.afterLoginRedirect ?? DEFAULT_AFTER_LOGIN,
      afterLogoutRedirect: config.auth.afterLogoutRedirect ?? DEFAULT_AFTER_LOGOUT,
      publicRoutes: config.auth.publicRoutes ?? DEFAULT_PUBLIC_ROUTES,
    },
    layout: {
      sidebarPosition: 'left',
      sidebarCollapsible: true,
      sidebarDefaultCollapsed: false,
      ...config.layout,
    },
    theme: {
      mode: 'system',
      ...config.theme,
    },
  } as ResolvedAdminConfig
}
