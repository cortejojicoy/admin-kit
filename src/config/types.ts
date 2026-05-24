import type { ComponentType, ReactNode } from 'react'
import type { AuthProvider, AuthUser, JWTAuthConfig, OAuthConfig } from '../auth/types'
import type { NavSection } from '../navigation/types'
import type { AdminModule } from '../modules/types'

export type RouterFlavor = 'app' | 'pages'

export interface LoginPageConfig {
  path?: string
  title?: string
  subtitle?: string
  logo?: ReactNode
  component?: ComponentType<LoginPageProps>
}

export interface LoginPageProps {
  onSubmit?: (credentials: Record<string, string>) => Promise<void> | void
  error?: string | null
  loading?: boolean
}

export interface AuthConfig {
  provider: 'jwt' | 'oauth' | 'custom'
  jwt?: JWTAuthConfig
  oauth?: OAuthConfig
  custom?: AuthProvider
  loginPage?: LoginPageConfig
  afterLoginRedirect?: string
  afterLogoutRedirect?: string
  publicRoutes?: string[]
  authorize?: (user: AuthUser, pathname: string) => boolean
}

export interface ThemeConfig {
  mode?: 'light' | 'dark' | 'system'
  primaryColor?: string
  tokens?: Record<string, string>
  className?: string
}

export interface LayoutConfig {
  sidebarPosition?: 'left' | 'right'
  sidebarCollapsible?: boolean
  sidebarDefaultCollapsed?: boolean
  topbar?: {
    visible?: boolean
    component?: ComponentType
  }
  footer?: {
    visible?: boolean
    component?: ComponentType
  }
}

export interface AppConfig {
  name: string
  logo?: ReactNode | string
  description?: string
  url?: string
}

export interface AdminConfig {
  app: AppConfig
  router?: RouterFlavor
  auth: AuthConfig
  navigation: {
    sections: NavSection[]
  }
  modules?: AdminModule[]
  theme?: ThemeConfig
  layout?: LayoutConfig
}

export type ResolvedAdminConfig = Required<Pick<AdminConfig, 'app' | 'auth' | 'navigation'>> &
  AdminConfig & {
    router: RouterFlavor
    layout: Required<Pick<LayoutConfig, 'sidebarPosition' | 'sidebarCollapsible' | 'sidebarDefaultCollapsed'>> & LayoutConfig
  }
