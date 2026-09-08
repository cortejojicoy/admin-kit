import type { AdminConfig } from './types'

/**
 * Strip everything a React Server Component cannot hand to a client component.
 *
 * Use it at the boundary:
 *
 *   // app/layout.tsx (server)
 *   <AdminProvider config={serializeConfig(adminConfig)} snapshot={snapshot}>
 *
 * What goes: resource `map` functions, the live `auth.custom` provider, plugins
 * (they hold components), and any secret that leaked into the auth config. The
 * client re-attaches maps and plugins from its own import of the same config
 * module, so nothing is lost — but nothing crosses the wire that cannot.
 *
 * The returned object is a shallow-ish clone: the parts that are kept are
 * shared by reference, since they are already plain data.
 */
export function serializeConfig(config: AdminConfig): AdminConfig {
  const { custom: _custom, ...auth } = config.auth

  const jwt = auth.jwt
    ? (() => {
        // `secret` should never have been on this object; drop it defensively
        // rather than trusting that no consumer ever set it.
        const { secret: _secret, mapUser: _mapUser, mapTokens: _mapTokens, ...rest } = auth.jwt
        return rest
      })()
    : undefined

  return {
    ...config,
    auth: { ...auth, jwt },
    plugins: undefined,
    resources: config.resources?.map(({ map: _map, ...resource }) => resource),
  }
}

/**
 * Assert that a config carries nothing unserializable. Returns the offending
 * paths rather than throwing, so a test or the CLI can report all of them at
 * once. Used by `admin-kit docs` and by the kit's own tests.
 */
export function findUnserializable(value: unknown, path = 'config', seen = new Set<unknown>()): string[] {
  if (value == null) return []
  const t = typeof value
  if (t === 'function') return [path]
  if (t === 'symbol') return [path]
  if (t !== 'object') return []
  if (seen.has(value)) return []
  seen.add(value)

  const out: string[] = []
  if (Array.isArray(value)) {
    value.forEach((v, i) => out.push(...findUnserializable(v, `${path}[${i}]`, seen)))
    return out
  }
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out.push(...findUnserializable(v, `${path}.${key}`, seen))
  }
  return out
}
