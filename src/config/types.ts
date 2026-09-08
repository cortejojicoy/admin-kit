import type { AccessConfig } from '../access/types'
import type { AuthProvider, JWTAuthConfig, OAuthConfig } from '../auth/types'
import type { NavSection } from '../navigation/types'
import type { AdminPlugin, ModuleDescriptor } from '../modules/types'
import type { ResourceDescriptor } from '../data/types'

export type RouterFlavor = 'app' | 'pages'

/**
 * Login page options. Serializable only — v0.1.x allowed a `logo: ReactNode`
 * and a `component: ComponentType` here, which made the config impossible to
 * hand from a server component to a client one. Replacing the whole page is now
 * done by passing `components={{ LoginPage }}` to `<AdminProvider>`, where
 * components belong.
 */
export interface LoginPageConfig {
  path?: string
  title?: string
  subtitle?: string
  logoIconKey?: string
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
  /** A live provider object. Not serializable; client-side config only. */
  custom?: AuthProvider
  loginPage?: LoginPageConfig
  afterLoginRedirect?: string
  afterLogoutRedirect?: string
  publicRoutes?: string[]
  /** Endpoint returning the current user. Defaults to `jwt.endpoints.me`. */
  meEndpoint?: string
  /** Where the user's roles live on the `/me` payload. Default `roles`. */
  rolesField?: string
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
  topbar?: { visible?: boolean }
  footer?: { visible?: boolean; text?: string }
  /** Max content width, as a CSS length. Default `80rem`. */
  maxWidth?: string
}

/**
 * The app panel: the launcher. Daily work, for **every** account.
 *
 * The panel split is by kind of work, not by kind of account — the reference
 * implementation's original mistake was flipping the entire chrome on an
 * `isAdmin` flag, so administrators never saw the launcher and everyone else
 * never saw a sidebar, and "the admin layout" was just the app with different
 * navigation.
 */
export interface AppPanelConfig {
  enabled?: boolean
  /** Launcher home route. Default `/dashboard`. */
  home?: string
  title?: string
  /** Show the centred search slot in the topbar. */
  search?: boolean
  /** Modules pinned into the quick-access dock, in this order. */
  dockOrder?: string[]
  /** Greeting shown above the tiles. `false` hides it. */
  greeting?: boolean
}

/** The admin panel: sidebar, configuration work, guarded at the layout. */
export interface AdminPanelConfig {
  enabled?: boolean
  /** Route prefix. Default `/admin`. */
  basePath?: string
  title?: string
  /** Sidebar sections. Static by design — the panel is admin-gated as a whole. */
  sections?: NavSection[]
  /** Where "back to app" points. Defaults to the app panel's home. */
  backTo?: string
  /** Roles allowed in. Defaults to `access.adminRoles`. */
  roles?: string[]
}

export interface PanelsConfig {
  app?: AppPanelConfig
  admin?: AdminPanelConfig
}

export interface AppConfig {
  name: string
  /** Icon registry key for the brand mark. */
  logoIconKey?: string
  /** Or a URL, if the mark is an image. */
  logoUrl?: string
  description?: string
  url?: string
  /**
   * Tenant flavour, used to pick between per-flavour wordings in module copy.
   * One install of one codebase describing itself differently per customer.
   */
  flavor?: string
}

export interface AdminConfig {
  app: AppConfig
  router?: RouterFlavor
  auth: AuthConfig
  /** Sidebar sections for the admin panel and the classic single-shell layout. */
  navigation?: { sections: NavSection[] }
  /** Presentation overlay for the backend module catalog, keyed by code. */
  modules?: ModuleDescriptor[]
  /** Code-bearing feature packs (providers, widgets). Client-side only. */
  plugins?: AdminPlugin[]
  /** CRUD resources. `map` functions are stripped by `serializeConfig`. */
  resources?: ResourceDescriptor[]
  access?: AccessConfig
  panels?: PanelsConfig
  theme?: ThemeConfig
  layout?: LayoutConfig
  /** Base URL prefixed onto every relative endpoint. Default: same origin. */
  apiBaseUrl?: string
}

/**
 * Server-only configuration. Kept in a **separate object in a separate file**
 * so secrets are not reachable from the module graph a client component
 * imports. v0.1.x put `secret` on `config.auth.jwt`, which survived only
 * because Next strips non-`NEXT_PUBLIC_` env vars from client bundles — one
 * hardcoded string or one `NEXT_PUBLIC_` prefix away from shipping the signing
 * key to the browser.
 */
export interface AdminServerConfig {
  jwt?: {
    /** HMAC secret for verifying session tokens. */
    secret?: string
    /** Algorithms accepted. Default `['HS256']`. */
    algorithms?: string[]
    /** Cookie the session token is read from. Falls back to the auth config. */
    cookieName?: string
  }
  /** Absolute base URL used for server-side fetches to the API. */
  apiBaseUrl?: string
}

export type ResolvedLayout = Required<
  Pick<LayoutConfig, 'sidebarPosition' | 'sidebarCollapsible' | 'sidebarDefaultCollapsed' | 'maxWidth'>
> &
  LayoutConfig

export type ResolvedPanels = {
  app: Required<Pick<AppPanelConfig, 'enabled' | 'home' | 'search' | 'greeting'>> & AppPanelConfig
  admin: Required<Pick<AdminPanelConfig, 'enabled' | 'basePath'>> & AdminPanelConfig
}

export type ResolvedAdminConfig = AdminConfig & {
  router: RouterFlavor
  auth: AuthConfig & Required<Pick<AuthConfig, 'loginPage' | 'afterLoginRedirect' | 'afterLogoutRedirect' | 'publicRoutes'>>
  navigation: { sections: NavSection[] }
  modules: ModuleDescriptor[]
  resources: ResourceDescriptor[]
  access: AccessConfig
  layout: ResolvedLayout
  panels: ResolvedPanels
  theme: ThemeConfig
}
