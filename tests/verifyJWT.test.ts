import { describe, expect, it } from 'vitest'
import { verifyJWT } from '../src/auth/server/verifyJWT'

const SECRET = 'a-test-secret-that-is-long-enough'

/** Sign a token the same way a backend would, so the tests exercise real input. */
async function sign(
  payload: Record<string, unknown>,
  options: { alg?: string; secret?: string } = {},
): Promise<string> {
  const alg = options.alg ?? 'HS256'
  const header = b64url(JSON.stringify({ alg, typ: 'JWT' }))
  const body = b64url(JSON.stringify(payload))
  const data = `${header}.${body}`

  const hash = alg === 'HS512' ? 'SHA-512' : alg === 'HS384' ? 'SHA-384' : 'SHA-256'
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(options.secret ?? SECRET),
    { name: 'HMAC', hash },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return `${data}.${b64urlBytes(new Uint8Array(signature))}`
}

function b64url(input: string): string {
  return b64urlBytes(new TextEncoder().encode(input))
}

function b64urlBytes(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const now = () => Math.floor(Date.now() / 1000)

describe('verifyJWT', () => {
  it('accepts a correctly signed token', async () => {
    const token = await sign({ sub: 'user-1', exp: now() + 60 })
    const result = await verifyJWT(token, SECRET)
    expect(result.valid).toBe(true)
    expect(result.payload?.sub).toBe('user-1')
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await sign({ sub: 'user-1' }, { secret: 'the-wrong-secret-entirely' })
    const result = await verifyJWT(token, SECRET)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('bad-signature')
  })

  it('rejects a tampered payload', async () => {
    const token = await sign({ sub: 'user-1', role: 'viewer', exp: now() + 60 })
    const [header, , signature] = token.split('.')
    const forged = b64url(JSON.stringify({ sub: 'user-1', role: 'admin', exp: now() + 60 }))
    const result = await verifyJWT(`${header}.${forged}.${signature}`, SECRET)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('bad-signature')
  })

  it('rejects alg: none', async () => {
    const header = b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))
    const body = b64url(JSON.stringify({ sub: 'attacker' }))
    const result = await verifyJWT(`${header}.${body}.`, SECRET)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('alg-not-allowed')
  })

  it('rejects an algorithm outside the allowlist even when it can verify it', async () => {
    // HS512 is implemented, so without an explicit allowlist this token would
    // verify. The allowlist is what makes the accepted set the verifier's
    // decision rather than the token's.
    const token = await sign({ sub: 'user-1' }, { alg: 'HS512' })
    expect((await verifyJWT(token, SECRET, { algorithms: ['HS512'] })).valid).toBe(true)
    const restricted = await verifyJWT(token, SECRET, { algorithms: ['HS256'] })
    expect(restricted.valid).toBe(false)
    expect(restricted.reason).toBe('alg-not-allowed:HS512')
  })

  it('defaults to HS256 only', async () => {
    const token = await sign({ sub: 'user-1' }, { alg: 'HS384' })
    expect((await verifyJWT(token, SECRET)).valid).toBe(false)
  })

  it('rejects an expired token', async () => {
    const token = await sign({ sub: 'user-1', exp: now() - 1 })
    const result = await verifyJWT(token, SECRET)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('expired')
  })

  it('applies clock tolerance to both exp and nbf', async () => {
    // Symmetric, matching the convention every JWT library follows: skew
    // between two servers cuts both ways, so a token that just expired and a
    // token that is not quite valid yet are both inside the same window.
    const justExpired = await sign({ sub: 'user-1', exp: now() - 20 })
    expect((await verifyJWT(justExpired, SECRET)).valid).toBe(false)
    expect((await verifyJWT(justExpired, SECRET, { clockTolerance: 60 })).valid).toBe(true)

    const notYet = await sign({ sub: 'user-1', nbf: now() + 20, exp: now() + 600 })
    expect((await verifyJWT(notYet, SECRET)).valid).toBe(false)
    expect((await verifyJWT(notYet, SECRET, { clockTolerance: 60 })).valid).toBe(true)

    // Well outside the window is still refused.
    const longExpired = await sign({ sub: 'user-1', exp: now() - 3600 })
    expect((await verifyJWT(longExpired, SECRET, { clockTolerance: 60 })).valid).toBe(false)
  })

  it('rejects a not-yet-valid token', async () => {
    const token = await sign({ sub: 'user-1', nbf: now() + 600 })
    expect((await verifyJWT(token, SECRET)).reason).toBe('not-yet-valid')
  })

  it.each([
    ['empty', ''],
    ['two segments', 'a.b'],
    ['four segments', 'a.b.c.d'],
    ['non-base64 header', '!!!.e30.sig'],
    ['garbage', 'not-a-token-at-all'],
  ])('rejects malformed input: %s', async (_label, token) => {
    const result = await verifyJWT(token, SECRET)
    expect(result.valid).toBe(false)
    expect(result.payload).toBeNull()
  })

  it('does not throw on a signature that is not base64url', async () => {
    const token = await sign({ sub: 'user-1', exp: now() + 60 })
    const [header, body] = token.split('.')
    const result = await verifyJWT(`${header}.${body}.###`, SECRET)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('malformed-signature')
  })
})
