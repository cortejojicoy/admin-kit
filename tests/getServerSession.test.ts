import { describe, expect, it } from 'vitest'
import { getServerSession, rolesFromSession } from '../src/auth/server/getServerSession'
import { sessionCookie } from '../src/auth/server/cookies'
import type { AdminConfig } from '../src/config/types'

const SECRET = 'test-secret-value-long-enough-here'

async function token(payload: Record<string, unknown>): Promise<string> {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const data = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)),
  )
  let binary = ''
  for (const byte of signature) binary += String.fromCharCode(byte)
  const sig = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${data}.${sig}`
}

const config: AdminConfig = {
  app: { name: 'Test' },
  auth: {
    provider: 'jwt',
    jwt: { endpoints: { login: '/l', me: '/m' }, cookieName: 'session' },
  },
}

const serverConfig = { jwt: { secret: SECRET, cookieName: 'session' } }

function requestWith(cookie: string): Request {
  return new Request('https://app.test/', { headers: { cookie } })
}

describe('getServerSession', () => {
  it('returns the session for a valid cookie', async () => {
    const jwt = await token({ sub: 'u1', roles: ['editor'], exp: Math.floor(Date.now() / 1000) + 60 })
    const session = await getServerSession(config, requestWith(`session=${jwt}`), { serverConfig })
    expect(session?.user.sub).toBe('u1')
    expect(session?.accessToken).toBe(jwt)
  })

  it('returns null with no cookie', async () => {
    const session = await getServerSession(config, requestWith('other=1'), { serverConfig })
    expect(session).toBeNull()
  })

  it('returns null for a token it cannot verify', async () => {
    const session = await getServerSession(config, requestWith('session=nonsense'), { serverConfig })
    expect(session).toBeNull()
  })

  it('refuses to run without a secret, and says where to put it', async () => {
    await expect(getServerSession(config, requestWith('session=x'))).rejects.toThrow(
      /secret is required/i,
    )
  })

  it('accepts a Pages Router style headers object', async () => {
    const jwt = await token({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 60 })
    const session = await getServerSession(
      config,
      { headers: { cookie: `session=${jwt}` } },
      { serverConfig },
    )
    expect(session?.user.sub).toBe('u1')
  })

  it('reads a cookie built by sessionCookie', async () => {
    // The two halves have to agree on the name, so exercise them together.
    const jwt = await token({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 60 })
    const header = sessionCookie(jwt, { name: 'session' })
    const value = header.split(';')[0]
    const session = await getServerSession(config, requestWith(value), { serverConfig })
    expect(session?.user.sub).toBe('u1')
  })

  it('reads roles using the configured field', () => {
    expect(rolesFromSession(config, { user: { id: '1', roles: ['a'] } })).toEqual(['a'])
    expect(
      rolesFromSession(
        { ...config, auth: { ...config.auth, rolesField: 'groups' } },
        { user: { id: '1', groups: ['g'] } },
      ),
    ).toEqual(['g'])
    expect(rolesFromSession(config, null)).toEqual([])
    expect(rolesFromSession(config, { user: { id: '1' } })).toEqual([])
  })
})
