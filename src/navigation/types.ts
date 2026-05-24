import type { ReactNode } from 'react'
import type { AuthUser } from '../auth/types'

export interface NavItem {
  id?: string
  label: string
  href?: string
  icon?: ReactNode
  badge?: ReactNode | string | number
  external?: boolean
  /** Hide this item from rendering. Useful for feature flags. */
  hidden?: boolean
  /** Restrict to users with any of these roles. */
  roles?: string[]
  /** Restrict to users with any of these permissions. */
  permissions?: string[]
  /** Programmatic visibility check; runs after role/permission filters. */
  visible?: (user: AuthUser | null) => boolean
  /** Nested items render as a collapsible group. */
  children?: NavItem[]
  /** Optional sort weight; lower comes first. Default 0. */
  order?: number
}

export interface NavSection {
  id?: string
  label?: string
  items: NavItem[]
  roles?: string[]
  permissions?: string[]
  visible?: (user: AuthUser | null) => boolean
  order?: number
}
