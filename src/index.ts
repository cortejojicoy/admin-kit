/**
 * Core entry — config, types, and pure helpers.
 *
 * Deliberately free of React and DOM code, so it can be loaded by Node (the
 * `admin-kit` CLI imports the consumer's config through it) and by edge
 * middleware.
 *
 *   @cortejojicoy/admin-kit             this file
 *   @cortejojicoy/admin-kit/client      providers, hooks, contexts
 *   @cortejojicoy/admin-kit/data        resources, data provider, CRUD hooks
 *   @cortejojicoy/admin-kit/access      permission engine, <Can>, guards
 *   @cortejojicoy/admin-kit/ui          panels, components, generated screens
 *   @cortejojicoy/admin-kit/server      session, guards, cookies
 *   @cortejojicoy/admin-kit/middleware  edge middleware
 *   @cortejojicoy/admin-kit/styles.css  the stylesheet
 */

export { defineAdminConfig, defineAdminServerConfig } from './config/defineConfig'
export {
  resolveConfig,
  DEFAULT_LOGIN_PATH,
  DEFAULT_AFTER_LOGIN,
  DEFAULT_AFTER_LOGOUT,
  DEFAULT_APP_HOME,
  DEFAULT_ADMIN_BASE,
} from './config/defaults'
export { serializeConfig, findUnserializable } from './config/serialize'

export { buildNav, modulesToSections } from './navigation/buildNav'
export { filterNav } from './navigation/filterNav'
export {
  buildModules,
  tileModules,
  dockModules,
  catalogFromDescriptors,
} from './modules/catalog'
export { copyFor } from './modules/types'
export { createPluginRegistry, createModuleRegistry } from './modules/registry'

export {
  createAccessEngine,
  expandRoles,
  matchesPattern,
} from './access/engine'
export type { AccessEngine, ModuleAccessShape } from './access/engine'
export {
  ACCESS_LEVELS,
  atLeast,
  isAccessLevel,
  rankOf,
  strongest,
  toAccessLevel,
  toPermissionsMap,
} from './access/levels'
export { EMPTY_SNAPSHOT } from './access/types'

export { createRestDataProvider, buildListQuery, fillPath } from './data/restProvider'
export { createHttpClient, HttpError, joinUrl, appendQuery } from './http/client'
export { DataStore, cacheKey, resourcePrefix } from './data/store'

export { cn } from './utils/cn'
export { DEFAULT_TOKENS, DARK_TOKENS, tokensToStyle, tokensFromPrimary } from './theme/tokens'

/* --------------------------------- types --------------------------------- */

export type {
  AdminConfig,
  AdminServerConfig,
  ResolvedAdminConfig,
  AuthConfig,
  AppConfig,
  LayoutConfig,
  ThemeConfig,
  LoginPageConfig,
  LoginPageProps,
  RouterFlavor,
  PanelsConfig,
  AppPanelConfig,
  AdminPanelConfig,
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
  TokenStorage,
  OAuthConfig,
  OAuthProviderConfig,
} from './auth/types'

export type { NavItem, NavSection } from './navigation/types'
export type {
  AdminPlugin,
  AdminModule,
  ModuleDescriptor,
  ModulePlacement,
  FlavoredCopy,
} from './modules/types'

export type {
  AccessConfig,
  AccessSnapshot,
  ModuleCatalogEntry,
  OnUnavailable,
  PermissionsAxisConfig,
  EntitlementsAxisConfig,
  CatalogAxisConfig,
} from './access/types'
export type { AccessLevel, PermissionsMap } from './access/levels'

export type {
  DataProvider,
  ResourceDescriptor,
  ResourceEndpoints,
  ResourceMappers,
  EndpointDescriptor,
  FieldDescriptor,
  ListParams,
  ListResult,
  NormalizedError,
  QueryNaming,
  CrudOperation,
  HttpMethod,
} from './data/types'
export type { HttpClient, HttpClientOptions, HttpRequest } from './http/client'
