import { describe, expect, it, vi } from 'vitest'

// next/server is not resolvable outside a Next build, and the middleware's whole
// job is to return the right NextResponse — so the double records which one.
vi.mock('next/server', () => ({
  NextResponse: {
    next: () => ({ kind: 'next', status: 200 }),
    redirect: (url: URL | string) => ({ kind: 'redirect', status: 307, url: String(url) }),
  },
}))

const { createAdminMiddleware } = await import('../src/middleware')
const { defineAdminConfig } = await import('../src/config/defineConfig')

const config = defineAdminConfig({
  app: { name: 'Test' },
  auth: {
    provider: 'jwt',
    jwt: { endpoints: { login: '/api/auth/login', me: '/api/auth/me' }, cookieName: 'session' },
    loginPage: { path: '/login' },
    publicRoutes: ['/login', '/api/auth', '/public'],
  },
})

function request(path: string, cookie?: string): Request {
  return new Request(`https://app.test${path}`, {
    headers: cookie ? { cookie } : {},
  })
}

describe('createAdminMiddleware', () => {
  it('passes a request through with NextResponse.next()', async () => {
    // The bug this replaces returned `new Response(null, { status: 200 })`,
    // which in Next middleware replaces the page with an empty body — every
    // authenticated route rendered blank.
    const middleware = createAdminMiddleware(config, { verify: () => ({ valid: true }) })
    const result = (await middleware(request('/dashboard', 'session=token'))) as unknown as {
      kind: string
    }
    expect(result.kind).toBe('next')
  })

  it('lets public routes and their children through without a cookie', async () => {
    const middleware = createAdminMiddleware(config)
    for (const path of ['/login', '/public', '/public/nested', '/api/auth/login']) {
      const result = (await middleware(request(path))) as unknown as { kind: string }
      expect(result.kind, path).toBe('next')
    }
  })

  it('does not treat a prefix collision as public', async () => {
    // '/publicity' starts with '/public' as a string but is not under it.
    const middleware = createAdminMiddleware(config)
    const result = (await middleware(request('/publicity'))) as unknown as { kind: string }
    expect(result.kind).toBe('redirect')
  })

  it('redirects to login with the destination preserved', async () => {
    const middleware = createAdminMiddleware(config)
    const result = (await middleware(request('/reports?range=30d'))) as unknown as { url: string }
    const url = new URL(result.url)
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('next')).toBe('/reports?range=30d')
  })

  it('redirects when verification fails', async () => {
    const middleware = createAdminMiddleware(config, { verify: () => ({ valid: false }) })
    const result = (await middleware(request('/dashboard', 'session=bad'))) as unknown as {
      kind: string
    }
    expect(result.kind).toBe('redirect')
  })

  it('reads the configured cookie name, not a default', async () => {
    const middleware = createAdminMiddleware(config, { verify: () => ({ valid: true }) })
    const wrongName = (await middleware(
      request('/dashboard', 'admin_kit_token=token'),
    )) as unknown as { kind: string }
    expect(wrongName.kind).toBe('redirect')
  })

  it('passes a merely-present cookie through when no verifier is configured', async () => {
    // Documented and deliberate: without a secret this layer cannot check
    // anything, and presence is not authentication. The server-side guards are
    // what actually gate the data.
    const middleware = createAdminMiddleware({
      ...config,
      auth: { ...config.auth, provider: 'oauth', jwt: undefined },
    })
    const result = (await middleware(request('/dashboard', 'admin_kit_token=anything'))) as unknown as {
      kind: string
    }
    expect(result.kind).toBe('next')
  })

  it('merges extra public routes from options', async () => {
    const middleware = createAdminMiddleware(config, { publicRoutes: ['/health'] })
    const result = (await middleware(request('/health'))) as unknown as { kind: string }
    expect(result.kind).toBe('next')
  })

  it('verifies with the configured algorithm allowlist', async () => {
    const verify = vi.fn(() => ({ valid: true }))
    const middleware = createAdminMiddleware(config, { verify })
    await middleware(request('/dashboard', 'session=abc'))
    expect(verify).toHaveBeenCalledWith('abc')
  })
})
