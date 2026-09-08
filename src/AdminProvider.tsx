'use client'

import { useMemo } from 'react'
import type { ReactNode } from 'react'
import type { AdminConfig } from './config/types'
import { resolveConfig } from './config/defaults'
import { AdminConfigProvider } from './context/AdminConfigContext'
import { RouterProvider, type RouterBridge } from './context/RouterContext'
import { AuthContextProvider } from './auth/AuthContext'
import { useAuth } from './auth/useAuth'
import { AccessProvider } from './access/AccessProvider'
import type { AccessSnapshot } from './access/types'
import { toPermissionsMap } from './access/levels'
import { PluginProvider } from './modules/PluginContext'
import { ThemeProvider } from './theme/ThemeProvider'
import { IconProvider, type IconRegistry } from './icons/registry'
import { DataProviderContext, DataStoreProvider } from './data/context'
import { createRestDataProvider } from './data/restProvider'
import type { DataProvider } from './data/types'
import type { AuthSession, AuthUser } from './auth/types'

export interface AdminProviderProps {
  config: AdminConfig
  /** Session resolved on the server, so the first paint is already correct. */
  initialSession?: AuthSession | null
  /**
   * Access resolved on the server. Omit it and the snapshot is derived from the
   * user's own `roles`/`permissions` fields, which is the right default for a
   * backend whose `/me` payload already carries them.
   */
  snapshot?: AccessSnapshot
  /** Icon components, keyed to match the `iconKey`s used in config. */
  icons?: IconRegistry
  /** Supply a data provider; one is built from `config` when omitted. */
  dataProvider?: DataProvider
  /** Override the router bridge (tests, or an unsupported router). */
  router?: RouterBridge
  children: ReactNode
}

/**
 * The single provider a consumer mounts.
 *
 * Composition order matters and reads outside-in:
 *
 *   Icons → Theme → Config → Router → Auth → Access → Plugins → Data
 *
 * Auth sits above Access because the snapshot fallback is derived from the
 * signed-in user; Access sits above Plugins because a plugin's `enabled`
 * predicate is an access question; Data sits innermost because its client needs
 * the session to attach credentials.
 */
export function AdminProvider({
  config,
  initialSession,
  snapshot,
  icons,
  dataProvider,
  router,
  children,
}: AdminProviderProps) {
  const resolved = useMemo(() => resolveConfig(config), [config])

  return (
    <IconProvider icons={icons}>
      <ThemeProvider theme={resolved.theme}>
        <AdminConfigProvider value={resolved}>
          <RouterProvider flavor={resolved.router} bridge={router}>
            <AuthContextProvider config={resolved.auth} initialSession={initialSession}>
              <AccessBridge snapshot={snapshot} config={resolved.access} rolesField={resolved.auth.rolesField}>
                <PluginProvider plugins={resolved.plugins}>
                  <DataBridge provider={dataProvider} config={resolved}>
                    {children}
                  </DataBridge>
                </PluginProvider>
              </AccessBridge>
            </AuthContextProvider>
          </RouterProvider>
        </AdminConfigProvider>
      </ThemeProvider>
    </IconProvider>
  )
}

/**
 * Derive an access snapshot from the session when the server didn't supply one.
 *
 * A `/me` payload that already carries `roles` and `permissions` is the common
 * case and needs no extra round trip. Note the distinction the engine cares
 * about: a user with an empty `permissions` array has been told "nothing", while
 * a user with no `permissions` **key** has told us nothing — the second is
 * `null`, and that is what triggers the fail-open behaviour.
 */
function AccessBridge({
  snapshot,
  config,
  rolesField,
  children,
}: {
  snapshot?: AccessSnapshot
  config: NonNullable<AdminConfig['access']>
  rolesField?: string
  children: ReactNode
}) {
  const { user } = useAuth()

  const derived = useMemo<AccessSnapshot>(() => {
    if (snapshot) return snapshot
    return snapshotFromUser(user, { rolesField, adminRoles: config.adminRoles })
  }, [snapshot, user, rolesField, config.adminRoles])

  return (
    <AccessProvider snapshot={derived} config={config}>
      {children}
    </AccessProvider>
  )
}

export function snapshotFromUser(
  user: AuthUser | null,
  opts: { rolesField?: string; adminRoles?: string[] } = {},
): AccessSnapshot {
  if (!user) return { permissions: null, entitlements: null, roles: [], isAdmin: false }

  const rawRoles = user[opts.rolesField ?? 'roles']
  const roles = Array.isArray(rawRoles) ? rawRoles.map(String) : []
  const adminRoles = opts.adminRoles ?? ['admin']

  const rawPermissions = user.permissions
  const permissions = rawPermissions == null ? null : toPermissionsMap(rawPermissions)

  return {
    permissions,
    entitlements: null,
    roles,
    isAdmin: roles.some((r) => adminRoles.includes(r)),
  }
}

function DataBridge({
  provider,
  config,
  children,
}: {
  provider?: DataProvider
  config: ReturnType<typeof resolveConfig>
  children: ReactNode
}) {
  const value = useMemo(
    () => provider ?? createRestDataProvider({ resources: config.resources, baseUrl: config.apiBaseUrl }),
    [provider, config.resources, config.apiBaseUrl],
  )
  return (
    <DataProviderContext.Provider value={value}>
      <DataStoreProvider>{children}</DataStoreProvider>
    </DataProviderContext.Provider>
  )
}
