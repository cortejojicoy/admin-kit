import type { ComponentType, ReactNode } from 'react'
import type { AccessLevel } from '../access/levels'
import type { NavItem, NavSection } from '../navigation/types'

/**
 * Where a module surfaces in the app panel.
 *
 *   `tile` — a card on the launcher home. For modules people *run their shift
 *            from*: the thing they open and stay in.
 *   `dock` — a cell in the quick-access bar. For *stations* people step into and
 *            back out of — check a reading, take a payment. Given cards of equal
 *            weight, stations dilute the grid into equally-likely choices, which
 *            is the mistake this split exists to avoid.
 *   `nav`  — reachable, but not advertised on the home view.
 *   `hidden` — registered for access checks only.
 */
export type ModulePlacement = 'tile' | 'dock' | 'nav' | 'hidden'

/**
 * Copy that can be worded per tenant flavour. One codebase often serves
 * installs where a module genuinely means different things; `default` is what
 * any flavour without its own entry gets, so adding a flavour later inherits
 * sensible wording instead of rendering blank.
 */
export type FlavoredCopy = string | ({ default: string } & Record<string, string>)

export function copyFor(copy: FlavoredCopy | undefined, flavor?: string): string | undefined {
  if (copy == null) return undefined
  if (typeof copy === 'string') return copy
  return (flavor ? copy[flavor] : undefined) || copy.default
}

/**
 * A module descriptor — the **presentation overlay** for one entry in the
 * backend's module catalog, keyed by `code`.
 *
 * The division of labour: the backend owns which modules exist, their title,
 * their order and whether they are active; the frontend owns how they look and
 * where they sit. A catalog entry with no descriptor simply does not render, and
 * a descriptor with no catalog entry is dropped — so enabling a module server
 * side makes it appear with no frontend deploy, while presentation stays where
 * presentation belongs.
 *
 * Plain data, for the same reason as `NavItem`.
 */
export interface ModuleDescriptor {
  /** Permission/catalog code, e.g. `'BILLING'`. */
  code: string
  title: string
  description?: FlavoredCopy
  /** Route the module opens. */
  href: string
  iconKey?: string
  /** Grouping bucket, used for section headers and ordering. */
  group?: string
  order?: number
  /** Extra codes that also grant access — how two backend modules merge into one entry. */
  accessCodes?: string[]
  requiredLevel?: AccessLevel
  placement?: ModulePlacement
  /**
   * Visual weight on the launcher home. `primary` takes the wide cell,
   * `critical` the highlighted one beside it; the shell falls back to an even
   * grid when the user holds neither, so the layout degrades by permission.
   */
  emphasis?: 'primary' | 'critical'
  /** Palette key resolved by the tile component. */
  tone?: string
  /** Static footer stats, when the module has no live metric. */
  stats?: Array<{ label: string; value: string }>
  /** In-module sub-navigation, rendered once the user is inside it. */
  nav?: NavItem[]
}

/**
 * A plugin is a code-bearing feature pack: it can wrap the tree in a provider
 * and contribute widgets. Unlike `ModuleDescriptor` it holds components, so it
 * is **not** serializable and must be registered from a client module.
 *
 * Kept separate from module descriptors precisely because mixing the two is
 * what made v0.1.x's config impossible to pass across the RSC boundary.
 */
export interface AdminPlugin {
  id: string
  name?: string
  description?: string
  /** Sections appended to the sidebar; same-id sections merge. */
  navSections?: NavSection[]
  /** Module descriptors contributed by the plugin. */
  modules?: ModuleDescriptor[]
  /** Wraps children, composed in declaration order. */
  Provider?: ComponentType<{ children: ReactNode }>
  /** Widgets keyed by slot name, rendered by `<WidgetSlot name="…" />`. */
  widgets?: Record<string, ComponentType>
  /** Runs once at boot; a `false` result skips the plugin entirely. */
  enabled?: (ctx: { roles: string[]; isAdmin: boolean }) => boolean
}

/** @deprecated Renamed to `AdminPlugin` in 0.2.0. Kept as an alias until 1.0. */
export type AdminModule = AdminPlugin
