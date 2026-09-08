import { createAccessEngine } from '../engine'
import { atLeast, type AccessLevel } from '../levels'
import type { AccessSnapshot } from '../types'
import type { AdminConfig } from '../../config/types'
import { buildModules } from '../../modules/catalog'
import { resolveAccess, resolveCatalog, type ResolveAccessOptions } from './resolve'

/**
 * Server-side gates.
 *
 * The rule these exist to enforce: **the nav filter is what makes a panel
 * honest; a guard is what makes it a gate.** A hidden link is still a reachable
 * URL, and `<Can>` hiding a button does nothing to the endpoint behind it. Every
 * generated page gets one of these.
 *
 * They throw `AccessDeniedError` rather than calling `redirect()` themselves, so
 * the same functions work in App Router server components, route handlers, and
 * `getServerSideProps` — each of which redirects differently. The App Router
 * helpers in `@cortejojicoy/admin-kit/server` wrap them.
 */
export class AccessDeniedError extends Error {
  readonly code: string
  readonly reason: 'unauthenticated' | 'entitlement' | 'permission' | 'admin'
  readonly redirectTo?: string

  constructor(reason: AccessDeniedError['reason'], code: string, redirectTo?: string) {
    super(`Access denied (${reason}${code ? `: ${code}` : ''})`)
    this.name = 'AccessDeniedError'
    this.reason = reason
    this.code = code
    this.redirectTo = redirectTo
  }
}

export interface GuardOptions extends ResolveAccessOptions {
  /** Where the caller should send a denied user. */
  redirectTo?: string
  /** A snapshot already resolved for this request. */
  snapshot?: AccessSnapshot
}

async function snapshotFor(config: AdminConfig, options: GuardOptions): Promise<AccessSnapshot> {
  return options.snapshot ?? (await resolveAccess(config, options))
}

/**
 * May this user open this module?
 *
 * Checks entitlement first and permission second, because they are different
 * failures: a tenant that does not run a module has no such page, while a user
 * without permission has a page they may not see. Both end in a redirect, but
 * only the first should ever be described to the user as "not found".
 */
export async function checkModule(
  config: AdminConfig,
  code: string,
  options: GuardOptions = {},
): Promise<{ ok: true } | { ok: false; error: AccessDeniedError }> {
  const snapshot = await snapshotFor(config, options)
  const engine = createAccessEngine(snapshot, config.access ?? {})

  const fallback = options.redirectTo ?? config.panels?.app?.home ?? '/'

  if (!engine.entitled(code)) {
    return { ok: false, error: new AccessDeniedError('entitlement', code, fallback) }
  }

  const modules = config.modules ?? []
  const descriptor = modules.find((m) => m.code === code)
  const level = engine.levelForModule({
    code,
    accessCodes: descriptor?.accessCodes,
  })
  const required = descriptor?.requiredLevel ?? config.access?.defaultRequiredLevel ?? 'view'

  if (!atLeast(level, required)) {
    return { ok: false, error: new AccessDeniedError('permission', code, fallback) }
  }
  return { ok: true }
}

/** Throwing form of {@link checkModule}. */
export async function requireModule(
  config: AdminConfig,
  code: string,
  options: GuardOptions = {},
): Promise<void> {
  const result = await checkModule(config, code, options)
  if (!result.ok) throw result.error
}

/**
 * The tenant axis alone — for a page that *configures* a module this install may
 * not run. Separate from `requireModule` because an administrator's permissions
 * open every module by definition, so a permission check here would always pass
 * and only obscure what is actually being enforced.
 */
export async function requireEntitlement(
  config: AdminConfig,
  code: string,
  options: GuardOptions = {},
): Promise<void> {
  const snapshot = await snapshotFor(config, options)
  const engine = createAccessEngine(snapshot, config.access ?? {})
  if (!engine.entitled(code)) {
    throw new AccessDeniedError(
      'entitlement',
      code,
      options.redirectTo ?? config.panels?.admin?.basePath ?? '/',
    )
  }
}

/**
 * Guard the admin panel. Unlike the module guards this fails **closed**: user
 * administration and the permission matrix decide who can access what, so a
 * session that cannot be read must not open them.
 */
export async function requireAdmin(config: AdminConfig, options: GuardOptions = {}): Promise<void> {
  const snapshot = await snapshotFor(config, options)
  const adminRoles = config.panels?.admin?.roles ?? config.access?.adminRoles ?? ['admin']
  const isAdmin = snapshot.isAdmin || snapshot.roles.some((r) => adminRoles.includes(r))
  if (!isAdmin) {
    throw new AccessDeniedError('admin', '', options.redirectTo ?? config.panels?.app?.home ?? '/')
  }
}

/**
 * Assert a single permission — the check that belongs at the top of every route
 * handler that writes anything.
 */
export async function assertPermission(
  config: AdminConfig,
  code: string,
  options: GuardOptions & { level?: AccessLevel } = {},
): Promise<void> {
  const snapshot = await snapshotFor(config, options)
  const engine = createAccessEngine(snapshot, config.access ?? {})
  if (!engine.can(code, options.level ?? 'full')) {
    throw new AccessDeniedError('permission', code, options.redirectTo)
  }
}

/**
 * The modules this request should see: catalog ∩ descriptors, entitlement-gated
 * and permission-filtered. What the launcher renders, resolved on the server so
 * the first paint is already correct.
 */
export async function resolveModules(config: AdminConfig, options: GuardOptions = {}) {
  const [snapshot, catalog] = await Promise.all([
    snapshotFor(config, options),
    resolveCatalog(config, options),
  ])
  const engine = createAccessEngine(snapshot, config.access ?? {})

  const modules = buildModules(catalog, config.modules ?? [], {
    flavor: config.app.flavor,
    entitled: (code) => engine.entitled(code),
  })

  return {
    snapshot,
    modules: modules.filter((m) =>
      engine.moduleVisible({ code: m.code, accessCodes: m.accessCodes, requiredLevel: m.requiredLevel }),
    ),
  }
}
