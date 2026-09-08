import type { ModuleCatalogEntry } from '../access/types'
import { copyFor, type ModuleDescriptor } from './types'

export interface BuildModulesOptions {
  /** Tenant flavour used to pick between per-flavour descriptions. */
  flavor?: string
  /** Entitlement gate. Omit to skip the axis entirely. */
  entitled?: (code: string) => boolean
}

/**
 * Fold the backend catalog together with the frontend presentation overlay.
 *
 * The division of labour is the point:
 *
 *   - the **catalog** (backend) decides which modules exist, what they are
 *     called, what order they come in, and whether they are active;
 *   - the **descriptors** (frontend) decide how they look and where they sit.
 *
 * So a module enabled in the backend appears with no frontend deploy, and a
 * catalog entry nobody has designed a tile for simply does not render instead
 * of showing up as an unlabelled square. A descriptor with no catalog entry is
 * dropped for the same reason — it would render a link to a module this install
 * does not run.
 *
 * A `null` catalog means "could not be read". Then the descriptors *are* the
 * list, because a navigation that goes blank when a status endpoint hiccups is
 * worse than one that shows a module the user turns out not to have.
 */
export function buildModules(
  catalog: ModuleCatalogEntry[] | null,
  descriptors: ModuleDescriptor[],
  options: BuildModulesOptions = {},
): ModuleDescriptor[] {
  const overlay = new Map(descriptors.map((d) => [d.code, d]))

  const resolved: ModuleDescriptor[] = []

  if (catalog === null) {
    resolved.push(...descriptors)
  } else {
    for (const entry of catalog) {
      if (entry.active === false) continue
      const descriptor = overlay.get(entry.code)
      if (!descriptor) continue
      resolved.push({
        ...descriptor,
        // The backend owns the wording of its own catalog; the descriptor's
        // title is the fallback for a catalog that only sends codes.
        title: entry.title ?? descriptor.title,
        description: descriptor.description ?? entry.description,
        order: descriptor.order ?? entry.order,
      })
    }
  }

  const gated = options.entitled ? resolved.filter((m) => options.entitled!(m.code)) : resolved

  // `order` defaults to 0 — the same neutral default `buildNav` uses for
  // sections, so one rule covers both: negative sorts ahead of unordered
  // entries, positive sorts behind them, and ties keep declaration order
  // (Array.prototype.sort is stable).
  return gated
    .map((mod) => ({ ...mod, description: copyFor(mod.description, options.flavor) }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/** Modules that belong on the launcher home as tiles. */
export function tileModules(modules: ModuleDescriptor[]): ModuleDescriptor[] {
  return modules.filter((m) => (m.placement ?? 'tile') === 'tile')
}

/**
 * Modules that belong in the quick-access dock, in **config order** rather than
 * catalog order.
 *
 * The dock is a short fixed row people navigate by muscle memory. Letting the
 * backend's ordering reach it means the cell under your thumb moves when
 * someone reorders a seed file.
 */
export function dockModules(modules: ModuleDescriptor[], order: string[] = []): ModuleDescriptor[] {
  const docked = modules.filter((m) => m.placement === 'dock')
  if (order.length === 0) return docked
  const byCode = new Map(docked.map((m) => [m.code, m]))
  const ordered = order.map((code) => byCode.get(code)).filter((m): m is ModuleDescriptor => m != null)
  // Anything docked but unlisted still shows, after the pinned ones.
  const listed = new Set(order)
  return [...ordered, ...docked.filter((m) => !listed.has(m.code))]
}

/**
 * A static catalog derived from the descriptors, for the fallback path. Keeping
 * it a function of the overlay means the fallback cannot drift out of sync with
 * the modules the app actually declares.
 */
export function catalogFromDescriptors(descriptors: ModuleDescriptor[]): ModuleCatalogEntry[] {
  return descriptors.map((d) => ({
    code: d.code,
    title: d.title,
    order: d.order,
    active: true,
  }))
}
