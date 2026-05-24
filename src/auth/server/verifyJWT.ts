/**
 * Edge-safe JWT verification using the Web Crypto API.
 * Supports HS256 / HS384 / HS512. For RS*/ ES* algorithms, plug in `jose`
 * via the `verify` option on createAdminMiddleware (custom verifier).
 */

const enc = new TextEncoder()

function base64UrlDecode(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  const b64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary')
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function decodeJSON<T>(seg: string): T {
  const bytes = base64UrlDecode(seg)
  const text = new TextDecoder().decode(bytes)
  return JSON.parse(text) as T
}

const ALGS: Record<string, { name: 'HMAC'; hash: string }> = {
  HS256: { name: 'HMAC', hash: 'SHA-256' },
  HS384: { name: 'HMAC', hash: 'SHA-384' },
  HS512: { name: 'HMAC', hash: 'SHA-512' },
}

export interface JWTPayload {
  sub?: string
  exp?: number
  iat?: number
  nbf?: number
  [key: string]: unknown
}

export interface VerifyResult {
  valid: boolean
  payload: JWTPayload | null
  reason?: string
}

export async function verifyJWT(token: string, secret: string): Promise<VerifyResult> {
  const parts = token.split('.')
  if (parts.length !== 3) return { valid: false, payload: null, reason: 'malformed' }
  const [headerSeg, payloadSeg, sigSeg] = parts
  let header: { alg?: string; typ?: string }
  try {
    header = decodeJSON<{ alg?: string; typ?: string }>(headerSeg)
  } catch {
    return { valid: false, payload: null, reason: 'bad-header' }
  }
  const algSpec = header.alg ? ALGS[header.alg] : undefined
  if (!algSpec) return { valid: false, payload: null, reason: `unsupported-alg:${header.alg}` }

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: algSpec.hash },
    false,
    ['verify'],
  )
  const data = enc.encode(`${headerSeg}.${payloadSeg}`)
  const sig = base64UrlDecode(sigSeg)
  const ok = await crypto.subtle.verify('HMAC', key, sig, data)
  if (!ok) return { valid: false, payload: null, reason: 'bad-signature' }

  let payload: JWTPayload
  try {
    payload = decodeJSON<JWTPayload>(payloadSeg)
  } catch {
    return { valid: false, payload: null, reason: 'bad-payload' }
  }

  const now = Math.floor(Date.now() / 1000)
  if (payload.exp != null && now >= payload.exp) return { valid: false, payload, reason: 'expired' }
  if (payload.nbf != null && now < payload.nbf) return { valid: false, payload, reason: 'not-yet-valid' }

  return { valid: true, payload }
}
