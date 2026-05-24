/**
 * Client entry — React components, providers, and hooks.
 * Importing from here loads "use client" modules; safe inside both the
 * App Router and Pages Router as long as you're in a client component.
 */
'use client'

export { AdminProvider } from './AdminProvider'

export { AuthContextProvider, AuthContext } from './auth/AuthContext'
export { useAuth } from './auth/useAuth'
export { LoginPage } from './auth/components/LoginPage'

export { AppRouterGuard } from './auth/guards/AppRouterGuard'
export { PagesRouterGuard } from './auth/guards/PagesRouterGuard'

export { createJWTProvider } from './auth/providers/JWTProvider'
export { createOAuthProvider } from './auth/providers/OAuthProvider'
export { createCustomProvider } from './auth/providers/CustomProvider'

export { SidebarProvider, SidebarContext } from './navigation/SidebarContext'
export { useSidebar } from './navigation/useSidebar'
export { Sidebar } from './navigation/Sidebar'
export { SidebarSection } from './navigation/SidebarSection'
export { SidebarItem } from './navigation/SidebarItem'
export { buildNav } from './navigation/buildNav'
export { filterNav } from './navigation/filterNav'

export { ModuleProvider, ModuleContext } from './modules/ModuleContext'
export { useModules } from './modules/useModules'
export { createModuleRegistry } from './modules/registry'

export { AdminLayout } from './components/layout/AdminLayout'
export { Topbar } from './components/layout/Topbar'
export { PageContainer } from './components/layout/PageContainer'

export { StatCard } from './components/dashboard/StatCard'
export { ChartCard } from './components/dashboard/ChartCard'
export { ActivityFeed } from './components/dashboard/ActivityFeed'

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

export { withAdminLayout } from './utils/withAdminLayout'

export { ThemeProvider, ThemeContext } from './theme/ThemeProvider'
export { useTheme } from './theme/useTheme'
export { DEFAULT_TOKENS, tokensToStyle } from './theme/tokens'
export type { ThemeMode, ThemeContextValue } from './theme/ThemeProvider'

export { cn } from './utils/cn'
