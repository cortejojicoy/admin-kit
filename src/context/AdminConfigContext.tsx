'use client'

import { createContext, useContext } from 'react'
import type { ResolvedAdminConfig } from '../config/types'

/**
 * The resolved config, reachable from anywhere below `<AdminProvider>`.
 *
 * Resolved exactly once — v0.1.x had consumers call `resolveConfig()` in their
 * layout *and* pass the result to `<AdminLayout config={…}>` while
 * `<AdminProvider>` resolved it again internally, so two copies of the same
 * defaults existed and could be edited apart.
 */
const AdminConfigContext = createContext<ResolvedAdminConfig | null>(null)

export const AdminConfigProvider = AdminConfigContext.Provider

export function useAdminConfig(): ResolvedAdminConfig {
  const config = useContext(AdminConfigContext)
  if (!config) {
    throw new Error(
      'useAdminConfig must be used inside <AdminProvider>. ' +
        'Wrap your app in <AdminProvider config={adminConfig}>.',
    )
  }
  return config
}

/** Non-throwing variant, for components that can render without a config. */
export function useOptionalAdminConfig(): ResolvedAdminConfig | null {
  return useContext(AdminConfigContext)
}
