import { atLeast } from '../access/levels'
import type { AccessEngine } from '../access/engine'
import type { NavItem, NavSection } from './types'

/**
 * Filter navigation through the access engine.
 *
 * v0.1.x compared `user.roles` against `item.roles` inline here. That put a
 * second, subtly different permission implementation next to the real one — so
 * the sidebar could disagree with a page guard about the same item. There is
 * now exactly one engine, and this walks the tree asking it.
 *
 * Pure and synchronous, so it can run on the server (with the request's
 * snapshot) and produce a tree that is already correct before it reaches the
 * client.
 */
export function filterNav(sections: NavSection[], access: AccessEngine): NavSection[] {
  const out: NavSection[] = []
  for (const section of sections) {
    if (!allowed(section, access)) continue
    const items = section.items
      .map((item) => filterItem(item, access))
      .filter((item): item is NavItem => item !== null)
    // A section with nothing left in it is chrome with no content.
    if (items.length === 0) continue
    out.push({ ...section, items })
  }
  return out
}

function filterItem(item: NavItem, access: AccessEngine): NavItem | null {
  if (item.hidden) return null
  if (!allowed(item, access)) return null

  if (item.children?.length) {
    const children = item.children
      .map((child) => filterItem(child, access))
      .filter((child): child is NavItem => child !== null)
    // A group whose children are all denied disappears — unless it is also a
    // link in its own right, in which case it stays as a plain item.
    if (children.length === 0) return item.href ? { ...item, children: undefined } : null
    return { ...item, children }
  }
  return item
}

interface Guarded {
  roles?: string[]
  permissions?: string[]
  accessCodes?: string[]
  requiredLevel?: Parameters<AccessEngine['can']>[1]
}

/**
 * Every declared constraint must pass (AND across kinds), and any one value
 * within a kind is enough (OR within a kind). "Visible to editors" and "visible
 * to holders of `users:list`" listed together means both, which is the reading
 * that lets you narrow an item rather than accidentally widening it.
 */
function allowed(node: Guarded, access: AccessEngine): boolean {
  if (node.roles?.length && !node.roles.some((r) => access.roles.includes(r)) && !access.isAdmin) {
    return false
  }

  const codes = [...(node.permissions ?? []), ...(node.accessCodes ?? [])]
  if (codes.length === 0) return true

  const required = node.requiredLevel ?? 'view'
  return codes.some((code) => atLeast(access.levelFor(code), required))
}
