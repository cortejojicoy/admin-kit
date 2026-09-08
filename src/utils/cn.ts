/**
 * Minimal classname combiner. Filters falsy values (false/null/undefined/'')
 * and joins the rest with a space. Kept dependency-free on purpose; if the
 * consumer wants tailwind-merge semantics they can wrap this in their own.
 */
export type ClassValue = string | number | null | undefined | false | ClassValue[]

export function cn(...values: ClassValue[]): string {
  const out: string[] = []
  for (const v of values) {
    if (!v) continue
    if (typeof v === 'string' || typeof v === 'number') out.push(String(v))
    else if (Array.isArray(v)) {
      const inner = cn(...v)
      if (inner) out.push(inner)
    }
  }
  return out.join(' ')
}

/**
 * Stringify an unknown value for display.
 *
 * `String(value)` on an object yields `[object Object]`, which in a generated
 * table is indistinguishable from real data and sends people looking at their
 * database. Objects and arrays are serialized instead; `null`/`undefined`
 * become the caller's placeholder.
 */
export function toText(value: unknown, empty = ''): string {
  if (value == null) return empty
  switch (typeof value) {
    case 'string':
      return value
    case 'number':
    case 'boolean':
    case 'bigint':
      return String(value)
    case 'object':
      if (value instanceof Date) return value.toISOString()
      try {
        return JSON.stringify(value) ?? empty
      } catch {
        return empty
      }
    default:
      return empty
  }
}

/**
 * Fill `:param` placeholders in a template from a record.
 *
 * Exists so props that produce a URL can be **strings** rather than functions.
 * A function prop cannot be passed from a server component to a client one, so
 * `hrefFor={(row) => ...}` silently forces every page that renders a generated
 * table to become a client component. `hrefFor="/admin/users/:id"` does not.
 *
 * Lenient by design: a placeholder with no matching field is left as-is rather
 * than throwing, because a half-built link is a better failure than a crashed
 * page.
 */
export function interpolate(template: string, values: Record<string, unknown>): string {
  return template.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (match, key: string) => {
    const value = values[key]
    return value == null ? match : encodeURIComponent(toText(value))
  })
}
