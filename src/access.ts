/** Access entry — the permission engine and its React bindings. */
'use client'

export {
  AccessProvider,
  useAccess,
  usePermissions,
  useCan,
  useModuleVisible,
  Can,
  IfAdmin,
} from './access/AccessProvider'
export type { AccessProviderProps, CanProps } from './access/AccessProvider'

export { RequireAuth, RequirePermission, AppRouterGuard, PagesRouterGuard } from './ui/guards'

export { createAccessEngine, expandRoles, matchesPattern } from './access/engine'
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
export type {
  AccessConfig,
  AccessSnapshot,
  ModuleCatalogEntry,
  OnUnavailable,
} from './access/types'
export type { AccessLevel, PermissionsMap } from './access/levels'
