'use client'

import { createContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { AdminModule } from './types'
import type { AuthUser } from '../auth/types'
import { createModuleRegistry } from './registry'
import type { ModuleRegistry } from './registry'

export const ModuleContext = createContext<ModuleRegistry | null>(null)

export interface ModuleProviderProps {
  modules: AdminModule[]
  user: AuthUser | null
  children: ReactNode
}

/**
 * Composes each module's `Provider` in declaration order, then exposes the
 * registry via ModuleContext. Modules cannot register themselves at runtime —
 * everything is declared in config so SSR/CSR stay in sync.
 */
export function ModuleProvider({ modules, user, children }: ModuleProviderProps) {
  const registry = useMemo(() => createModuleRegistry(modules, user), [modules, user])

  let tree = <ModuleContext.Provider value={registry}>{children}</ModuleContext.Provider>
  for (let i = registry.all.length - 1; i >= 0; i--) {
    const M = registry.all[i]
    if (M.Provider) {
      const Provider = M.Provider
      tree = <Provider>{tree}</Provider>
    }
  }
  return tree
}
