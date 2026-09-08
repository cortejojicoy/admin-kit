'use client'

import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { createPluginRegistry, type PluginRegistry } from './registry'
import type { AdminPlugin } from './types'
import { useAccess } from '../access/AccessProvider'

const PluginContext = createContext<PluginRegistry | null>(null)

const EMPTY = createPluginRegistry([], { roles: [], isAdmin: false })

export function usePlugins(): PluginRegistry {
  return useContext(PluginContext) ?? EMPTY
}

/** @deprecated Renamed to `usePlugins` in 0.2.0. */
export const useModules = usePlugins

export interface PluginProviderProps {
  plugins?: AdminPlugin[]
  children: ReactNode
}

/**
 * Registers plugins and composes their providers.
 *
 * `enabled` is evaluated against the access engine rather than a raw user
 * object, so a plugin gated on "administrators only" agrees with everything
 * else that asks the same question.
 */
export function PluginProvider({ plugins, children }: PluginProviderProps) {
  const access = useAccess()
  const registry = useMemo(
    () => createPluginRegistry(plugins ?? [], { roles: [...access.roles], isAdmin: access.isAdmin }),
    [plugins, access],
  )

  // Compose right-to-left so the first-declared provider ends up outermost —
  // the order a consumer reading their own config would expect.
  const tree = useMemo(
    () =>
      registry
        .providers()
        .reduceRight<ReactNode>((inner, Provider) => <Provider>{inner}</Provider>, children),
    [registry, children],
  )

  return <PluginContext.Provider value={registry}>{tree}</PluginContext.Provider>
}

/** Render every widget a plugin contributed for `name`. */
export function WidgetSlot({ name, className }: { name: string; className?: string }) {
  const widgets = usePlugins().widgets(name)
  if (widgets.length === 0) return null
  return (
    <div className={className} data-slot={name}>
      {widgets.map(({ pluginId, Component }) => (
        <Component key={pluginId} />
      ))}
    </div>
  )
}
