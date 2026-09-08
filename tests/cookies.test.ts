import { describe, expect, it } from 'vitest'
import {
  clearSessionCookie,
  parseCookies,
  readCookieFromRequest,
  serializeCookie,
  sessionCookie,
} from '../src/auth/server/cookies'

describe('parseCookies', () => {
  it('parses a normal header', () => {
    expect(parseCookies('a=1; b=2')).toEqual({ a: '1', b: '2' })
  })

  it('handles no header at all', () => {
    expect(parseCookies(null)).toEqual({})
    expect(parseCookies(undefined)).toEqual({})
    expect(parseCookies('')).toEqual({})
  })

  it('decodes values and keeps ones containing "="', () => {
    // JWTs are base64url so they do not contain '=', but session blobs often
    // do, and splitting on every '=' would truncate them.
    expect(parseCookies('t=a.b.c%3D%3D')).toEqual({ t: 'a.b.c==' })
    expect(parseCookies('t=eyJ=padding')).toEqual({ t: 'eyJ=padding' })
  })

  it('ignores malformed segments without dropping the good ones', () => {
    expect(parseCookies('broken; a=1; ; =2')).toEqual({ a: '1' })
  })

  it('tolerates whitespace', () => {
    expect(parseCookies('  a = 1 ;b=2')).toEqual({ a: '1', b: '2' })
  })
})

describe('serializeCookie', () => {
  it('defaults to a root path and lax same-site', () => {
    expect(serializeCookie('t', 'v')).toBe('t=v; Path=/; SameSite=Lax')
  })

  it('encodes the value', () => {
    expect(serializeCookie('t', 'a b')).toContain('t=a%20b')
  })

  it('emits the flags it is given', () => {
    const cookie = serializeCookie('t', 'v', {
      httpOnly: true,
      secure: true,
      maxAge: 60,
      domain: 'app.test',
      sameSite: 'strict',
      path: '/admin',
    })
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('Max-Age=60')
    expect(cookie).toContain('Domain=app.test')
    expect(cookie).toContain('SameSite=Strict')
    expect(cookie).toContain('Path=/admin')
  })
})

describe('sessionCookie', () => {
  it('is HttpOnly and Secure by default', () => {
    // The default that matters: a token script cannot read survives an XSS
    // that a document.cookie-written token does not.
    const cookie = sessionCookie('the-token')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie.startsWith('admin_kit_token=the-token')).toBe(true)
  })

  it('takes a custom name and lifetime', () => {
    const cookie = sessionCookie('t', { name: 'session', maxAge: 3600 })
    expect(cookie.startsWith('session=t')).toBe(true)
    expect(cookie).toContain('Max-Age=3600')
  })

  it('can drop Secure for local http development', () => {
    expect(sessionCookie('t', { secure: false })).not.toContain('Secure')
  })

  it('expires the cookie on logout', () => {
    const cookie = clearSessionCookie({ name: 'session' })
    expect(cookie).toContain('Max-Age=0')
    expect(cookie).toContain('HttpOnly')
  })
})

describe('readCookieFromRequest', () => {
  it('reads one cookie from a Request', () => {
    const request = new Request('https://app.test/', { headers: { cookie: 'session=abc' } })
    expect(readCookieFromRequest(request, 'session')).toBe('abc')
    expect(readCookieFromRequest(request, 'other')).toBeNull()
  })
})
