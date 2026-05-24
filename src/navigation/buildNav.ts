import type { AdminModule } from '../modules/types'
import type { NavItem, NavSection } from './types'

/**
 * Merge nav sections declared in config with any contributed by modules.
 * Sections with the same `id` are merged: items are concatenated and sorted
 * by `order` (ascending, stable).
 */
export function buildNav(configSections: NavSection[], modules: AdminModule[] = []): NavSection[] {
  const map = new Map<string, NavSection>()
  let anonIdx = 0

  for (const s of configSections) {
    const id = s.id ?? `__anon_${anonIdx++}`
    map.set(id, { ...s, id, items: [...s.items] })
  }

  for (const m of modules) {
    for (const s of m.navSections ?? []) {
      const id = s.id ?? `__anon_${anonIdx++}`
      const existing = map.get(id)
      if (existing) {
        existing.items.push(...s.items)
      } else {
        map.set(id, { ...s, id, items: [...s.items] })
      }
    }
  }

  const sections = Array.from(map.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  for (const s of sections) {
    s.items = sortItems(s.items)
  }
  return sections
}

function sortItems(items: NavItem[]): NavItem[] {
  const sorted = items.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  return sorted.map((i) => (i.children ? { ...i, children: sortItems(i.children) } : i))
}
