/**
 * Access levels — the currency of every gate in the kit.
 *
 * A boolean `can()` cannot express read-only access, which is the single most
 * common real-world requirement ("the cashier may open Billing but not post to
 * it"). So the unit of permission is a level, and a boolean check is defined in
 * terms of it rather than the other way round.
 *
 * The order is total and meaningful: `none < view < full`. Everything else here
 * is arithmetic over that order.
 */

export type AccessLevel = 'none' | 'view' | 'full'

/** A permission map as returned by the permissions endpoint: code → level. */
export type PermissionsMap = Record<string, AccessLevel>

const RANK: Record<AccessLevel, number> = { none: 0, view: 1, full: 2 }

export const ACCESS_LEVELS: readonly AccessLevel[] = ['none', 'view', 'full']

export function isAccessLevel(value: unknown): value is AccessLevel {
  return typeof value === 'string' && value in RANK
}

/** Numeric rank, for comparisons. Unknown strings sort as `none`. */
export function rankOf(level: AccessLevel | undefined): number {
  return level ? (RANK[level] ?? 0) : 0
}

/** `true` when `level` is at least `required`. */
export function atLeast(level: AccessLevel | undefined, required: AccessLevel): boolean {
  return rankOf(level) >= rankOf(required)
}

/** The strongest of the given levels. `none` when the list is empty. */
export function strongest(levels: Array<AccessLevel | undefined>): AccessLevel {
  let best: AccessLevel = 'none'
  for (const level of levels) {
    if (!level) continue
    if (level === 'full') return 'full'
    if (rankOf(level) > rankOf(best)) best = level
  }
  return best
}

/**
 * Coerce whatever the backend sent into a level.
 *
 * Backends express this half a dozen ways and none of them are wrong: a level
 * string, a boolean, a numeric rank, or an object with flags. Normalizing here
 * means the engine only ever deals with one shape, and a consumer whose backend
 * does something stranger still has `mapPermissions` on the config.
 */
export function toAccessLevel(raw: unknown): AccessLevel {
  if (isAccessLevel(raw)) return raw
  if (raw === true) return 'full'
  if (raw === false || raw == null) return 'none'
  if (typeof raw === 'number') return raw >= 2 ? 'full' : raw === 1 ? 'view' : 'none'
  if (typeof raw === 'string') {
    const s = raw.toLowerCase()
    if (s === 'write' || s === 'edit' || s === 'admin' || s === 'all') return 'full'
    if (s === 'read' || s === 'readonly' || s === 'read-only') return 'view'
    return 'none'
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    if (o.level != null) return toAccessLevel(o.level)
    if (o.write === true || o.edit === true) return 'full'
    if (o.read === true || o.view === true) return 'view'
  }
  return 'none'
}

/** Normalize a whole permissions payload into a `PermissionsMap`. */
export function toPermissionsMap(raw: unknown): PermissionsMap {
  if (!raw || typeof raw !== 'object') return {}
  const out: PermissionsMap = {}

  // Array form: ['users:list', 'users:create'] — a grant list, all full.
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry === 'string') out[entry] = 'full'
      else if (entry && typeof entry === 'object') {
        const o = entry as Record<string, unknown>
        const code = typeof o.code === 'string' ? o.code : typeof o.name === 'string' ? o.name : null
        if (code) out[code] = toAccessLevel(o.level ?? o.access ?? o)
      }
    }
    return out
  }

  for (const [code, value] of Object.entries(raw as Record<string, unknown>)) {
    out[code] = toAccessLevel(value)
  }
  return out
}
