import type { AdminConfig, AdminServerConfig } from '../../config/types'
import { createHttpClient } from '../../http/client'
import { toPermissionsMap } from '../levels'
import type { AccessSnapshot, ModuleCatalogEntry } from '../types'
import { readCookieFromRequest } from '../../auth/server/cookies'
import { toText } from '../../utils/cn'

export interface ResolveAccessOptions {
  /** The incoming request — used for the cookie header and for per-request memoization. */
  request?: Request
  /** Bearer token, when the caller already has one. */
  token?: string | null
  serverConfig?: AdminServerConfig
  /** Roles, when the caller has already read the session. */
  roles?: string[]
  isAdmin?: boolean
}

/**
 * Resolve all three access axes for one request.
 *
 * Each axis answers a different question and fails in a different direction:
 *
 *   catalog      does the module exist and is it active?   → fall back to config
 *   entitlement  may this tenant run it?                   → fail open
 *   permission   may this user open it?                     → fail open
 *
 * The fail-open direction is deliberate. A control-plane read that failed must
 * not be able to lock a paying customer out of software they have paid for, and
 * a permissions endpoint returning 503 should degrade to "we could not check"
 * rather than "you have nothing". Set `onUnavailable: 'deny'` per axis where
 * absence genuinely means no.
 *
 * Anything protecting administration itself fails **closed** — see
 * `requireAdmin`, which reads the session and not this snapshot.
 */
export async function resolveAccess(
  config: AdminConfig,
  options: ResolveAccessOptions = {},
): Promise<AccessSnapshot> {
  return memoize(options.request, 'access', async () => {
    const access = config.access ?? {}
    const client = serverClient(config, options)

    const [permissions, entitlements] = await Promise.all([
      access.permissions?.endpoint
        ? client
            .get<unknown>(access.permissions.endpoint)
            .then((body) => toPermissionsMap(pick(body, access.permissions?.field ?? 'permissions')))
            .catch(() => null)
        : Promise.resolve(null),
      access.entitlements?.endpoint
        ? client
            .get<unknown>(access.entitlements.endpoint)
            .then((body) => {
              const value = pick(body, access.entitlements?.field ?? 'modules')
              return Array.isArray(value) ? value.map(String) : null
            })
            .catch(() => null)
        : Promise.resolve(null),
    ])

    const roles = options.roles ?? []
    const adminRoles = access.adminRoles ?? ['admin']

    return {
      permissions,
      entitlements,
      roles,
      isAdmin: options.isAdmin ?? roles.some((r) => adminRoles.includes(r)),
    }
  })
}

/**
 * Read the module catalog. `null` means it could not be read, which the module
 * builder treats as "use the declared descriptors" so navigation never blanks.
 */
export async function resolveCatalog(
  config: AdminConfig,
  options: ResolveAccessOptions = {},
): Promise<ModuleCatalogEntry[] | null> {
  const axis = config.access?.catalog
  if (!axis?.endpoint) return axis?.fallback ?? null

  return memoize(options.request, 'catalog', async () => {
    try {
      const body = await serverClient(config, options).get<unknown>(axis.endpoint!)
      const value = pick(body, axis.field ?? 'modules')
      const entries = Array.isArray(value) ? value : Array.isArray(body) ? body : null
      if (!entries) return axis.fallback ?? null
      return entries.map(normalizeEntry)
    } catch {
      return axis.fallback ?? null
    }
  })
}

function normalizeEntry(raw: unknown): ModuleCatalogEntry {
  const o = (raw ?? {}) as Record<string, unknown>
  return {
    code: toText(o.code ?? o.name),
    title: typeof o.title === 'string' ? o.title : undefined,
    description: typeof o.description === 'string' ? o.description : undefined,
    order: typeof o.order === 'number' ? o.order : typeof o.display_order === 'number' ? o.display_order : undefined,
    // Absent means active: a catalog that doesn't model the flag should not
    // have every module treated as switched off.
    active: o.active === undefined && o.is_active === undefined ? true : Boolean(o.active ?? o.is_active),
  }
}

function serverClient(config: AdminConfig, options: ResolveAccessOptions) {
  const cookieName = options.serverConfig?.jwt?.cookieName ?? config.auth.jwt?.cookieName ?? 'admin_kit_token'
  const token =
    options.token ??
    (options.request ? readCookieFromRequest(options.request, cookieName) : null)

  return createHttpClient({
    // Server-side fetch cannot resolve a relative URL, so an absolute base is
    // required here in a way it isn't in the browser.
    baseUrl: options.serverConfig?.apiBaseUrl ?? config.apiBaseUrl,
    getToken: () => token,
    // Forward the session cookie, for backends that authenticate by cookie.
    headers: (): Record<string, string> => {
      const cookie = options.request?.headers.get('cookie')
      return cookie ? { cookie } : {}
    },
    credentials: 'include',
  })
}

function pick(body: unknown, field: string): unknown {
  if (body && typeof body === 'object' && !Array.isArray(body) && field in (body)) {
    return (body as Record<string, unknown>)[field]
  }
  return body
}

/**
 * Memoize per request.
 *
 * The layout builds the nav, each page runs its guard, and the launcher filters
 * its tiles — all in one render, all asking the same question of the same
 * endpoint. Without this that is three or more identical round trips per
 * navigation for an answer that cannot change mid-request.
 *
 * Keyed off the `Request` object in a `WeakMap` rather than React's `cache()`,
 * so it works the same in a route handler, in `getServerSideProps`, and in a
 * server component. With no request to key on it simply doesn't cache.
 */
const memos = new WeakMap<object, Map<string, Promise<unknown>>>()

function memoize<T>(request: object | undefined, key: string, fn: () => Promise<T>): Promise<T> {
  if (!request) return fn()
  let map = memos.get(request)
  if (!map) {
    map = new Map()
    memos.set(request, map)
  }
  const existing = map.get(key)
  if (existing) return existing as Promise<T>
  const promise = fn()
  map.set(key, promise)
  return promise
}
