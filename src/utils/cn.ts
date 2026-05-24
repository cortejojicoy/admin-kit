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
