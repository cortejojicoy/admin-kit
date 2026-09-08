/**
 * Client entry — providers, contexts and hooks.
 *
 * Everything here is a client module. The published bundle carries the
 * `"use client"` directive (v0.1.8 lost it in bundling, which broke every App
 * Router consumer at build time).
 */
'use client'

export { AdminProvider, snapshotFromUser } from './AdminProvider'
export type { AdminProviderProps } from './AdminProvider'

export { AdminConfigProvider, useAdminConfig, useOptionalAdminConfig } from './context/AdminConfigContext'
export { RouterProvider, useRouterBridge, useCurrentPath, isActivePath } from './context/RouterContext'
export type { RouterBridge } from './context/RouterContext'

export { AuthContextProvider, AuthContext } from './auth/AuthContext'
export { useAuth, useOptionalAuth } from './auth/useAuth'
export { createJWTProvider } from './auth/providers/JWTProvider'
export { createOAuthProvider } from './auth/providers/OAuthProvider'
export { createCustomProvider } from './auth/providers/CustomProvider'

export {
  AccessProvider,
  useAccess,
  usePermissions,
  useCan,
  useModuleVisible,
  Can,
  IfAdmin,
} from './access/AccessProvider'

export { PluginProvider, usePlugins, useModules, WidgetSlot } from './modules/PluginContext'

export { IconProvider, Icon, useIcon, useIconRegistry, BUILTIN_ICONS } from './icons/registry'
export type { IconComponent, IconRegistry } from './icons/registry'

export { ThemeProvider, ThemeContext } from './theme/ThemeProvider'
export { useTheme } from './theme/useTheme'
export type { ThemeMode, ThemeContextValue } from './theme/ThemeProvider'

export { DataProviderContext, DataStoreProvider, useDataProvider, useDataStore } from './data/context'

export {
  useAppRouter,
  useAppPathname,
  useAppSearchParams,
  AppLink,
  appRouterAdapter,
} from './adapters/appRoute'
export {
  usePagesRouter,
  usePagesPathname,
  usePagesSearchParams,
  PagesLink,
  pagesRouterAdapter,
} from './adapters/pagesRoute'

export { cn } from './utils/cn'
