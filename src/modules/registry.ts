import type { ComponentType } from 'react'
import type { AdminPlugin } from './types'

export interface WidgetEntry {
  pluginId: string
  Component: ComponentType
}

export interface PluginRegistry {
  readonly all: AdminPlugin[]
  byId: (id: string) => AdminPlugin | undefined
  /** Every widget registered for a slot, in plugin declaration order. */
  widgets: (slot: string) => WidgetEntry[]
  /** Providers to compose, in declaration order. */
  providers: () => Array<NonNullable<AdminPlugin['Provider']>>
}

export interface PluginContext {
  roles: string[]
  isAdmin: boolean
}

/**
 * Build a lookup over the declared plugins.
 *
 * A pure function, not a global `registerPlugin()` side table: server and
 * client must see the same plugin set for the same request, and module-level
 * registration cannot promise that.
 *
 * (v0.1.x typed the widget lookup through a conditional that resolved to
 * `never`, because `widgets` is optional and `Record<string, C> | undefined`
 * does not extend `Record<string, infer V>` — so the returned `Component` was
 * unusable. It is a plain `ComponentType` now.)
 */
export function createPluginRegistry(
  plugins: AdminPlugin[] = [],
  context: PluginContext = { roles: [], isAdmin: false },
): PluginRegistry {
  const active = plugins.filter((p) => (p.enabled ? p.enabled(context) : true))
  const byId = new Map(active.map((p) => [p.id, p]))

  return {
    all: active,
    byId: (id) => byId.get(id),
    widgets: (slot) => {
      const out: WidgetEntry[] = []
      for (const plugin of active) {
        const Component = plugin.widgets?.[slot]
        if (Component) out.push({ pluginId: plugin.id, Component })
      }
      return out
    },
    providers: () =>
      active.map((p) => p.Provider).filter((P): P is NonNullable<AdminPlugin['Provider']> => P != null),
  }
}

/** @deprecated Renamed to `createPluginRegistry` in 0.2.0. */
export const createModuleRegistry = createPluginRegistry
/** @deprecated Renamed to `PluginRegistry` in 0.2.0. */
export type ModuleRegistry = PluginRegistry
