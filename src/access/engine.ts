import { atLeast, strongest, type AccessLevel, type PermissionsMap } from './levels'
import type { AccessConfig, AccessSnapshot } from './types'

/**
 * The access engine: one pure function of (snapshot, config) → answers.
 *
 * Pure and isomorphic on purpose. The same engine decides which nav entries
 * render, which tiles the launcher shows, whether `<Can>` renders its children,
 * and whether a server guard redirects — so those four can never disagree,
 * which is the failure mode when each surface rolls its own check.
 */
export interface AccessEngine {
  readonly isAdmin: boolean
  readonly roles: readonly string[]
  /** Effective level for a single permission code. */
  levelFor: (code: string) => AccessLevel
  /** `true` when the code is held at `required` or better (default `view`). */
  can: (code: string, required?: AccessLevel) => boolean
  canAny: (codes: readonly string[], required?: AccessLevel) => boolean
  canAll: (codes: readonly string[], required?: AccessLevel) => boolean
  /** Strongest level held over a module's own code plus its merged `accessCodes`. */
  levelForModule: (mod: ModuleAccessShape) => AccessLevel
  /** Entitlement axis only: may this tenant run the module at all? */
  entitled: (code: string) => boolean
  /** Entitled **and** permitted — what nav and tiles filter on. */
  moduleVisible: (mod: ModuleAccessShape) => boolean
}

/** The minimum a thing needs to be access-checked. */
export interface ModuleAccessShape {
  code: string
  accessCodes?: string[]
  requiredLevel?: AccessLevel
}

/** Does `pattern` (possibly containing `*` segments) match `code`? */
export function matchesPattern(pattern: string, code: string): boolean {
  if (pattern === '*' || pattern === code) return true
  if (!pattern.includes('*')) return false

  const p = pattern.split(':')
  const c = code.split(':')
  if (p[p.length - 1] === '*') {
    // A trailing '*' consumes one or more segments: `users:*` matches
    // `users:create` and `users:a:b`, but not the bare code `users` — a module
    // code and a permission on that module are different things, and letting
    // one pattern silently grant both widens roles by accident.
    if (c.length < p.length) return false
  } else if (p.length !== c.length) {
    return false
  }
  for (let i = 0; i < p.length; i++) {
    if (p[i] === '*') {
      if (i === p.length - 1) return true
      continue
    }
    if (p[i] !== c[i]) return false
  }
  return true
}

/**
 * Expand a user's roles into permission patterns, following `hierarchy`
 * transitively. Cycles are tolerated rather than thrown on: a config typo that
 * makes `admin` inherit `admin` should not crash every page.
 */
export function expandRoles(
  roles: readonly string[],
  config: Pick<AccessConfig, 'roles' | 'hierarchy'> = {},
): { roles: string[]; grants: string[] } {
  const seen = new Set<string>()
  const queue = [...roles]
  while (queue.length) {
    const role = queue.shift()!
    if (seen.has(role)) continue
    seen.add(role)
    for (const parent of config.hierarchy?.[role] ?? []) {
      if (!seen.has(parent)) queue.push(parent)
    }
  }
  const grants: string[] = []
  for (const role of seen) grants.push(...(config.roles?.[role] ?? []))
  return { roles: [...seen], grants }
}

export function createAccessEngine(
  snapshot: AccessSnapshot,
  config: AccessConfig = {},
): AccessEngine {
  const adminRoles = config.adminRoles ?? ['admin']
  const { roles: effectiveRoles, grants } = expandRoles(snapshot.roles, config)
  const isAdmin = snapshot.isAdmin || effectiveRoles.some((r) => adminRoles.includes(r))

  // Deny patterns come from the roles the user is **directly assigned**, not
  // from the roles those inherit.
  //
  // Inheritance exists to accumulate capability: `admin` inheriting `manager`
  // means an admin can do everything a manager can. If it also inherited
  // manager's *restrictions*, then adding a line to `hierarchy` would silently
  // take capabilities away from the senior role — so denying `users:delete` to
  // managers would quietly deny it to admins too. A restriction on a
  // subordinate role binds that role's holders, not their superiors.
  const denied: string[] = []
  for (const role of snapshot.roles) denied.push(...(config.deny?.[role] ?? []))

  const map: PermissionsMap | null = snapshot.permissions
  const permissionsUnavailable = map === null
  const failOpen = (config.permissions?.onUnavailable ?? 'allow') === 'allow'

  // Split the map once: exact keys answer in O(1), and only the (few) wildcard
  // keys need scanning per lookup.
  const exact = new Map<string, AccessLevel>()
  const wildcards: Array<[string, AccessLevel]> = []
  if (map) {
    for (const [code, level] of Object.entries(map)) {
      if (code.includes('*')) wildcards.push([code, level])
      else exact.set(code, level)
    }
  }

  const defaultRequired = config.defaultRequiredLevel ?? 'view'

  function levelFor(code: string): AccessLevel {
    if (denied.some((p) => matchesPattern(p, code))) return 'none'
    if (isAdmin) return 'full'

    const candidates: Array<AccessLevel | undefined> = []

    const direct = exact.get(code)
    if (direct) candidates.push(direct)
    for (const [pattern, level] of wildcards) {
      if (matchesPattern(pattern, code)) candidates.push(level)
    }
    // Role-derived grants are patterns, so they grant `full` when they match.
    if (grants.some((p) => matchesPattern(p, code))) candidates.push('full')

    if (candidates.length > 0) return strongest(candidates)

    // Nothing granted it. Distinguish "the backend said no" from "we never
    // heard from the backend" — the second is what `onUnavailable` governs.
    if (permissionsUnavailable && grants.length === 0) return failOpen ? 'full' : 'none'
    return 'none'
  }

  function can(code: string, required: AccessLevel = defaultRequired): boolean {
    return atLeast(levelFor(code), required)
  }

  const entitlements = snapshot.entitlements
  const entitlementsFailOpen = (config.entitlements?.onUnavailable ?? 'allow') === 'allow'
  const entitledSet = entitlements ? new Set(entitlements) : null

  function entitled(code: string): boolean {
    if (entitledSet === null) return entitlementsFailOpen
    return entitledSet.has(code)
  }

  function levelForModule(mod: ModuleAccessShape): AccessLevel {
    const codes = [mod.code, ...(mod.accessCodes ?? [])]
    return strongest(codes.map(levelFor))
  }

  return {
    isAdmin,
    roles: effectiveRoles,
    levelFor,
    can,
    canAny: (codes, required) => codes.some((c) => can(c, required)),
    canAll: (codes, required) => codes.every((c) => can(c, required)),
    levelForModule,
    entitled,
    moduleVisible: (mod) =>
      entitled(mod.code) && atLeast(levelForModule(mod), mod.requiredLevel ?? defaultRequired),
  }
}
