import type { AdminConfig, ResolvedAdminConfig } from './types'

export const DEFAULT_LOGIN_PATH = '/login'
export const DEFAULT_AFTER_LOGIN = '/dashboard'
export const DEFAULT_AFTER_LOGOUT = '/login'
export const DEFAULT_PUBLIC_ROUTES = ['/login', '/api/auth']
export const DEFAULT_APP_HOME = '/dashboard'
export const DEFAULT_ADMIN_BASE = '/admin'
export const DEFAULT_MAX_WIDTH = '80rem'

/**
 * Fill in every default exactly once, so no downstream code has to guess.
 *
 * Called by `<AdminProvider>` and by the server helpers; both are memoized on
 * the config object, so calling it twice on the same input is cheap but calling
 * it in a render path without memoization is not. Everything it returns is
 * plain data.
 */
export function resolveConfig(config: AdminConfig): ResolvedAdminConfig {
  const appHome = config.panels?.app?.home ?? DEFAULT_APP_HOME

  return {
    ...config,
    router: config.router ?? 'app',
    apiBaseUrl: config.apiBaseUrl,
    auth: {
      ...config.auth,
      loginPage: {
        path: DEFAULT_LOGIN_PATH,
        title: `Sign in to ${config.app.name}`,
        ...config.auth.loginPage,
      },
      afterLoginRedirect: config.auth.afterLoginRedirect ?? appHome,
      afterLogoutRedirect: config.auth.afterLogoutRedirect ?? DEFAULT_AFTER_LOGOUT,
      publicRoutes: config.auth.publicRoutes ?? DEFAULT_PUBLIC_ROUTES,
      rolesField: config.auth.rolesField ?? 'roles',
    },
    navigation: config.navigation ?? { sections: [] },
    modules: config.modules ?? [],
    plugins: config.plugins,
    resources: config.resources ?? [],
    access: config.access ?? {},
    layout: {
      sidebarPosition: 'left',
      sidebarCollapsible: true,
      sidebarDefaultCollapsed: false,
      maxWidth: DEFAULT_MAX_WIDTH,
      ...config.layout,
    },
    panels: {
      app: {
        enabled: true,
        home: appHome,
        search: true,
        greeting: true,
        ...config.panels?.app,
      },
      admin: {
        enabled: true,
        basePath: DEFAULT_ADMIN_BASE,
        backTo: appHome,
        ...config.panels?.admin,
      },
    },
    theme: {
      mode: 'system',
      ...config.theme,
    },
  }
}
