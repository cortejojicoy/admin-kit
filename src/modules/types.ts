import type { ComponentType, ReactNode } from 'react'
import type { NavSection } from '../navigation/types'
import type { AuthUser } from '../auth/types'

/**
 * An AdminModule is a self-contained feature pack a consumer can drop into
 * `config.modules`. Modules can contribute:
 *   - nav sections (merged into the sidebar)
 *   - top-level providers (wrapped around the children inside AdminProvider)
 *   - dashboard widgets (rendered by the optional <DashboardSlot moduleId="..." />)
 */
export interface AdminModule {
  id: string
  name?: string
  description?: string
  /** Sections appended to the sidebar (merged with the same-id config section if present). */
  navSections?: NavSection[]
  /** Wrap children in this provider. Composed in declaration order. */
  Provider?: ComponentType<{ children: ReactNode }>
  /** Optional dashboard widgets keyed by slot name. */
  widgets?: Record<string, ComponentType>
  /** Predicate that runs once at boot — if false, module is fully skipped. */
  enabled?: (ctx: { user: AuthUser | null }) => boolean
}
