import type { AdminModule } from './types'
import type { AuthUser } from '../auth/types'

export interface ModuleRegistry {
  readonly all: AdminModule[]
  byId: (id: string) => AdminModule | undefined
  widgets: (slot: string) => Array<{ moduleId: string; Component: AdminModule['widgets'] extends Record<string, infer V> ? V : never }>
}

/**
 * Build a typed lookup over the modules declared in config. This is a pure
 * function — no global state, no side effects, no `registerModule()` API —
 * so SSR and client see the same module set.
 */
export function createModuleRegistry(
  modules: AdminModule[],
  user: AuthUser | null,
): ModuleRegistry {
  const active = modules.filter((m) => (m.enabled ? m.enabled({ user }) : true))
  const byIdMap = new Map(active.map((m) => [m.id, m]))

  return {
    all: active,
    byId: (id) => byIdMap.get(id),
    widgets: (slot) =>
      active
        .filter((m) => m.widgets && slot in m.widgets)
        .map((m) => ({ moduleId: m.id, Component: m.widgets![slot]! })) as ReturnType<ModuleRegistry['widgets']>,
  }
}
