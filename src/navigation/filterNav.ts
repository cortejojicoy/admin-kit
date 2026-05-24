import type { AuthUser } from '../auth/types'
import type { NavItem, NavSection } from './types'

function userHasAny(user: AuthUser | null, required: string[] | undefined, key: 'roles' | 'permissions'): boolean {
  if (!required || required.length === 0) return true
  const have = (user?.[key] as string[] | undefined) ?? []
  return required.some((r) => have.includes(r))
}

function visibleItem(item: NavItem, user: AuthUser | null): NavItem | null {
  if (item.hidden) return null
  if (!userHasAny(user, item.roles, 'roles')) return null
  if (!userHasAny(user, item.permissions, 'permissions')) return null
  if (item.visible && !item.visible(user)) return null

  let children: NavItem[] | undefined
  if (item.children) {
    children = item.children.map((c) => visibleItem(c, user)).filter((c): c is NavItem => c !== null)
    if (children.length === 0 && !item.href) return null
  }
  return children ? { ...item, children } : item
}

export function filterNav(sections: NavSection[], user: AuthUser | null): NavSection[] {
  const out: NavSection[] = []
  for (const section of sections) {
    if (!userHasAny(user, section.roles, 'roles')) continue
    if (!userHasAny(user, section.permissions, 'permissions')) continue
    if (section.visible && !section.visible(user)) continue
    const items = section.items.map((i) => visibleItem(i, user)).filter((i): i is NavItem => i !== null)
    if (items.length === 0) continue
    out.push({ ...section, items })
  }
  return out
}
