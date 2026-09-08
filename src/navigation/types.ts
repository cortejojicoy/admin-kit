import type { AccessLevel } from '../access/levels'

/**
 * Navigation descriptors are **plain data**, deliberately.
 *
 * v0.1.x typed `icon` as a `ReactNode` and `visible` as a predicate, which made
 * a config carrying either one impossible to pass from a server component into
 * a client one — functions and JSX are not serializable. That blocked the whole
 * pattern this kit is built around: resolve navigation on the server, where the
 * user's permissions already are, and hand the finished tree to a client shell.
 *
 * So icons are **string keys** resolved to components by the renderer (see
 * `IconRegistry`), and visibility is declarative (`roles`, `permissions`,
 * `accessCodes`, `requiredLevel`) and evaluated by the access engine. Anything
 * genuinely dynamic belongs in a component, not in config.
 */
export interface NavItem {
  /** Stable id. Used to merge module-contributed items into config sections. */
  id?: string
  label: string
  href?: string
  /** Key into the icon registry, e.g. `'users'`. Not a component. */
  iconKey?: string
  /** Short badge text. A number or string, so it stays serializable. */
  badge?: string | number
  external?: boolean
  /** Hard hide, for feature flags. */
  hidden?: boolean
  /** Visible to users holding any of these roles. */
  roles?: string[]
  /** Visible to users holding any of these permission codes. */
  permissions?: string[]
  /** Alternative codes that also grant this item (merged submodules). */
  accessCodes?: string[]
  /** Minimum level required over `permissions`/`accessCodes`. Default `view`. */
  requiredLevel?: AccessLevel
  /** Nested items render as a collapsible group. */
  children?: NavItem[]
  /** Sort weight, ascending. Default 0. */
  order?: number
}

export interface NavSection {
  id?: string
  label?: string
  items: NavItem[]
  roles?: string[]
  permissions?: string[]
  accessCodes?: string[]
  requiredLevel?: AccessLevel
  order?: number
}
