/**
 * Edge-safe cookie helpers used by middleware and server helpers.
 * Avoid importing anything React/DOM here.
 */

export interface CookieOptions {
  path?: string
  maxAge?: number
  domain?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'lax' | 'strict' | 'none'
}

export function serializeCookie(name: string, value: string, opts: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`]
  parts.push(`Path=${opts.path ?? '/'}`)
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`)
  if (opts.domain) parts.push(`Domain=${opts.domain}`)
  if (opts.secure) parts.push('Secure')
  if (opts.httpOnly) parts.push('HttpOnly')
  parts.push(`SameSite=${opts.sameSite ?? 'Lax'}`)
  return parts.join('; ')
}

export function parseCookies(header: string | null | undefined): Record<string, string> {
  if (!header) return {}
  const out: Record<string, string> = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k) out[k] = decodeURIComponent(v)
  }
  return out
}

export function readCookieFromRequest(req: Request, name: string): string | null {
  return parseCookies(req.headers.get('cookie'))[name] ?? null
}
