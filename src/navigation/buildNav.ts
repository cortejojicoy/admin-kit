import type { ModuleDescriptor } from '../modules/types'
import type { AdminPlugin } from '../modules/types'
import type { NavItem, NavSection } from './types'

export interface BuildNavInput {
  /** Sections declared in config. */
  sections?: NavSection[]
  /** Plugins contributing their own sections. */
  plugins?: AdminPlugin[]
  /** Modules to fold in as items, grouped by their `group`. */
  modules?: ModuleDescriptor[]
  /** Labels for module groups, keyed by group id. */
  groupLabels?: Record<string, string>
  /** Group ordering; groups not listed sort after, alphabetically. */
  groupOrder?: string[]
}

/**
 * Merge every source of navigation into one ordered tree.
 *
 * Sections merge by `id`: a plugin contributing `{ id: 'workspace' }` appends
 * its items to the config's `workspace` section rather than adding a second
 * section with the same heading. Anonymous sections keep their own identity.
 */
export function buildNav(input: BuildNavInput): NavSection[] {
  const map = new Map<string, NavSection>()
  const order: string[] = []
  let anon = 0

  function upsert(section: NavSection): void {
    const id = section.id ?? `__anon_${anon++}`
    const existing = map.get(id)
    if (existing) {
      existing.items.push(...section.items)
      // First declaration wins on label/order — usually the consumer's config,
      // which should not be renamed by a plugin it installed.
      existing.label ??= section.label
      existing.order ??= section.order
      return
    }
    map.set(id, { ...section, id, items: [...section.items] })
    order.push(id)
  }

  for (const section of input.sections ?? []) upsert(section)
  for (const plugin of input.plugins ?? []) {
    for (const section of plugin.navSections ?? []) upsert(section)
  }
  for (const section of modulesToSections(input.modules ?? [], input.groupLabels, input.groupOrder)) {
    upsert(section)
  }

  const sections = [...map.values()].sort(byOrderThen(order))
  for (const section of sections) section.items = sortItems(section.items)
  return sections
}

/** Turn module descriptors into nav sections, one per `group`. */
export function modulesToSections(
  modules: ModuleDescriptor[],
  groupLabels: Record<string, string> = {},
  groupOrder: string[] = [],
): NavSection[] {
  const groups = new Map<string, NavItem[]>()
  for (const mod of modules) {
    if (mod.placement === 'hidden') continue
    const group = mod.group ?? ''
    const items = groups.get(group) ?? []
    items.push({
      id: `module:${mod.code}`,
      label: mod.title,
      href: mod.href,
      iconKey: mod.iconKey,
      accessCodes: [mod.code, ...(mod.accessCodes ?? [])],
      requiredLevel: mod.requiredLevel,
      order: mod.order,
      children: mod.nav,
    })
    groups.set(group, items)
  }

  return [...groups.entries()].map(([group, items]) => ({
    id: group ? `group:${group}` : undefined,
    label: group ? (groupLabels[group] ?? group) : undefined,
    items,
    order: group ? indexOrLast(groupOrder, group) : -1,
  }))
}

function indexOrLast(list: string[], value: string): number {
  const i = list.indexOf(value)
  return i === -1 ? list.length : i
}

/** Sort by explicit `order`, then by declaration order — a stable tiebreak. */
function byOrderThen(declaration: string[]) {
  return (a: NavSection, b: NavSection) => {
    const delta = (a.order ?? 0) - (b.order ?? 0)
    if (delta !== 0) return delta
    return declaration.indexOf(a.id!) - declaration.indexOf(b.id!)
  }
}

function sortItems(items: NavItem[]): NavItem[] {
  return items
    .map((item, i) => [item, i] as const)
    .sort(([a, ai], [b, bi]) => (a.order ?? 0) - (b.order ?? 0) || ai - bi)
    .map(([item]) => (item.children ? { ...item, children: sortItems(item.children) } : item))
}
