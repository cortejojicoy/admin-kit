/**
 * Edge-safe JWT verification using the Web Crypto API.
 * Supports HS256 / HS384 / HS512. For RS-family or ES-family algorithms,
 * plug in `jose` via the `verify` option on createAdminMiddleware
 * (custom verifier).
 */

const enc = new TextEncoder()

function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(input)) throw new Error('not base64url')
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  const b64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary')
  const out = new Uint8Array(new ArrayBuffer(bin.length))
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

export interface VerifyOptions {
  /**
   * Algorithms the caller is willing to accept. Default `['HS256']`.
   *
   * The `alg` header is attacker-controlled, so an allowlist chosen by the
   * *verifier* is what closes algorithm confusion. Without it, "look the header
   * up in a table of algorithms we support" quietly accepts any of them — fine
   * today because the table is HMAC-only, and a vulnerability the moment
   * someone adds RS256 to it.
   */
  algorithms?: string[]
  /** Seconds of leeway on `exp`/`nbf`, for clock skew. Default 0. */
  clockTolerance?: number
}

export async function verifyJWT(
  token: string,
  secret: string,
  options: VerifyOptions = {},
): Promise<VerifyResult> {
  const allowed = options.algorithms ?? ['HS256']
  const tolerance = options.clockTolerance ?? 0
  const parts = token.split('.')
  if (parts.length !== 3) return { valid: false, payload: null, reason: 'malformed' }
  const [headerSeg, payloadSeg, sigSeg] = parts
  let header: { alg?: string; typ?: string }
  try {
    header = decodeJSON<{ alg?: string; typ?: string }>(headerSeg)
  } catch {
    return { valid: false, payload: null, reason: 'bad-header' }
  }
  if (!header.alg || !allowed.includes(header.alg)) {
    return { valid: false, payload: null, reason: `alg-not-allowed:${header.alg ?? 'none'}` }
  }
  const algSpec = ALGS[header.alg]
  if (!algSpec) return { valid: false, payload: null, reason: `unsupported-alg:${header.alg}` }

  // Typed arrays, not `ArrayBuffer`.
  //
  // An earlier version copied into a fresh `ArrayBuffer` to satisfy the lib
  // types. That works in Node and *fails in Next's edge runtime*, which checks
  // the argument against its own realm's `ArrayBuffer` and rejects a buffer
  // constructed outside it: "2nd argument is not instance of ArrayBuffer,
  // Buffer, TypedArray, or DataView". A `Uint8Array` is accepted in both.
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: algSpec.hash },
    false,
    ['verify'],
  )
  const data = enc.encode(`${headerSeg}.${payloadSeg}`)
  let sig: Uint8Array<ArrayBuffer>
  try {
    sig = base64UrlDecode(sigSeg)
  } catch {
    return { valid: false, payload: null, reason: 'malformed-signature' }
  }
  const ok = await crypto.subtle.verify('HMAC', key, sig, data)
  if (!ok) return { valid: false, payload: null, reason: 'bad-signature' }

  let payload: JWTPayload
  try {
    payload = decodeJSON<JWTPayload>(payloadSeg)
  } catch {
    return { valid: false, payload: null, reason: 'bad-payload' }
  }

  const now = Math.floor(Date.now() / 1000)
  if (payload.exp != null && now - tolerance >= payload.exp) {
    return { valid: false, payload, reason: 'expired' }
  }
  if (payload.nbf != null && now + tolerance < payload.nbf) {
    return { valid: false, payload, reason: 'not-yet-valid' }
  }

  return { valid: true, payload }
}
