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
  // Canonical capitalization. The attribute is case-insensitive per RFC 6265,
  // but the config values are lowercase and not every cookie parser in the
  // wild is as forgiving as the spec.
  parts.push(`SameSite=${capitalize(opts.sameSite ?? 'lax')}`)
  return parts.join('; ')
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
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

/**
 * Build the session cookie your login route should set.
 *
 * `HttpOnly` and `Secure` by default, which is the whole point: a token the
 * browser sends automatically but script cannot read survives an XSS that a
 * `document.cookie`-written token does not.
 *
 *   // app/api/auth/login/route.ts
 *   return new Response(JSON.stringify({ ok: true }), {
 *     headers: { 'Set-Cookie': sessionCookie(token, { maxAge: 60 * 60 * 8 }) },
 *   })
 */
export function sessionCookie(
  token: string,
  opts: CookieOptions & { name?: string } = {},
): string {
  const { name = 'admin_kit_token', ...rest } = opts
  return serializeCookie(name, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    ...rest,
  })
}

/** The matching expiry cookie, for logout routes. */
export function clearSessionCookie(opts: CookieOptions & { name?: string } = {}): string {
  const { name = 'admin_kit_token', ...rest } = opts
  return serializeCookie(name, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    ...rest,
  })
}
