import type { AccessLevel, PermissionsMap } from './levels'

/**
 * How a gate behaves when its source cannot be read (no token, backend down,
 * non-2xx). This is a deliberate decision per axis, not a default to be
 * inherited blindly:
 *
 *   `allow` — fail open. Correct for permissions and entitlements, because a
 *             control-plane read that failed must not be able to put a paywall
 *             or a lockout in front of a customer who has paid.
 *   `deny`  — fail closed. Correct where absence genuinely means "this does not
 *             exist here", and for anything protecting administration itself.
 */
export type OnUnavailable = 'allow' | 'deny'

/** One entry of the module catalog, as the backend describes it. */
export interface ModuleCatalogEntry {
  code: string
  title?: string
  description?: string
  order?: number
  active?: boolean
}

export interface PermissionsAxisConfig {
  /** Endpoint returning `code → AccessLevel` (many shapes accepted, see `toPermissionsMap`). */
  endpoint?: string
  /** Property on the response holding the map. Default: `permissions`, else the body. */
  field?: string
  onUnavailable?: OnUnavailable
}

export interface EntitlementsAxisConfig {
  /** Endpoint returning the tenant/licence record. */
  endpoint?: string
  /** Property holding the entitled module codes. Default: `modules`. */
  field?: string
  onUnavailable?: OnUnavailable
}

export interface CatalogAxisConfig {
  /** Endpoint returning the module catalog. */
  endpoint?: string
  /** Property holding the entries. Default: `modules`, else the body if it is an array. */
  field?: string
  /** Used when the catalog cannot be read, so navigation never goes blank. */
  fallback?: ModuleCatalogEntry[]
}

/**
 * The access model. Every axis is optional: with none of them configured the
 * engine grants everything, which is the correct behaviour for a single-tenant
 * app with no permission backend yet.
 */
export interface AccessConfig {
  permissions?: PermissionsAxisConfig
  entitlements?: EntitlementsAxisConfig
  catalog?: CatalogAxisConfig
  /** role → permission patterns. Only needed when the backend sends roles, not permissions. */
  roles?: Record<string, string[]>
  /** role → roles it inherits. Resolved transitively. */
  hierarchy?: Record<string, string[]>
  /** role → permission patterns that are refused even if something else grants them. */
  deny?: Record<string, string[]>
  /** Roles treated as administrators: full access, and the admin panel opens for them. */
  adminRoles?: string[]
  /** Minimum level a nav entry needs when it doesn't say. Default `view`. */
  defaultRequiredLevel?: AccessLevel
}

/**
 * Everything the engine needs, resolved. Produced on the server and handed to
 * the client provider as plain data — no functions, no class instances.
 */
export interface AccessSnapshot {
  /** `null` means "could not be read", which is what triggers `onUnavailable`. */
  permissions: PermissionsMap | null
  /** `null` means unconstrained — not "entitled to nothing". */
  entitlements: string[] | null
  roles: string[]
  isAdmin: boolean
}

export const EMPTY_SNAPSHOT: AccessSnapshot = {
  permissions: null,
  entitlements: null,
  roles: [],
  isAdmin: false,
}
