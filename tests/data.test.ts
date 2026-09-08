import { describe, expect, it, vi } from 'vitest'
import { buildListQuery, createRestDataProvider, defaultListMapper, fillPath } from '../src/data/restProvider'
import { DataStore, cacheKey, stableStringify } from '../src/data/store'
import { createHttpClient, HttpError, appendQuery, joinUrl } from '../src/http/client'
import type { ResourceDescriptor } from '../src/data/types'

const users: ResourceDescriptor = {
  name: 'users',
  endpoints: {
    list: '/api/users',
    one: '/api/users/:id',
    create: { method: 'POST', path: '/api/users' },
    update: { method: 'PATCH', path: '/api/users/:id' },
    remove: { method: 'DELETE', path: '/api/users/:id' },
    impersonate: { method: 'POST', path: '/api/users/:id/impersonate' },
  },
  query: { page: 'page', perPage: 'per_page', search: 'q' },
}

/** A fetch double that records calls and replies with whatever is queued. */
function stubFetch(replies: Array<{ status?: number; body?: unknown }>) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetch = vi.fn(async (url: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init })
    const reply = replies.shift() ?? { status: 200, body: {} }
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls }
}

describe('url helpers', () => {
  it('joins a base with a path, leaving absolute URLs alone', () => {
    expect(joinUrl('https://api.test', '/users')).toBe('https://api.test/users')
    expect(joinUrl('https://api.test/', '/users')).toBe('https://api.test/users')
    expect(joinUrl(undefined, '/users')).toBe('/users')
    expect(joinUrl('https://api.test', 'https://other.test/x')).toBe('https://other.test/x')
  })

  it('appends query values and skips empties', () => {
    expect(appendQuery('/u', { a: 1, b: null, c: undefined, d: '' })).toBe('/u?a=1')
    expect(appendQuery('/u?x=1', { y: 2 })).toBe('/u?x=1&y=2')
    expect(appendQuery('/u', { ids: [1, 2] })).toBe('/u?ids=1&ids=2')
  })
})

describe('fillPath', () => {
  it('substitutes params and url-encodes them', () => {
    expect(fillPath('/api/users/:id', { id: 7 }).path).toBe('/api/users/7')
    expect(fillPath('/api/users/:id', { id: 'a b/c' }).path).toBe('/api/users/a%20b%2Fc')
  })

  it('names the missing parameter rather than sending a broken path', () => {
    expect(() => fillPath('/api/users/:id', {})).toThrow(/Missing "id"/)
  })

  it('keeps an unused id out of the query string', () => {
    expect(fillPath('/api/users', { id: 3 }).leftover).toEqual({ id: 3 })
    expect(fillPath('/api/users/:id', { id: 3 }).leftover).toEqual({})
  })
})

describe('buildListQuery', () => {
  it('uses the configured parameter names', () => {
    const q = buildListQuery({ page: 2, perPage: 10, search: 'ann' }, users.query)
    expect(q).toEqual({ page: 2, per_page: 10, q: 'ann' })
  })

  it('converts to zero-based paging when asked', () => {
    expect(buildListQuery({ page: 1 }, { pageBase: 0 }).page).toBe(0)
    expect(buildListQuery({ page: 3 }, { pageBase: 0 }).page).toBe(2)
  })

  it('supports bracketed filters', () => {
    const q = buildListQuery({ filter: { status: 'active' } }, { filterStyle: 'bracket' })
    expect(q['filter[status]']).toBe('active')
  })

  it('flattens filters by default and drops empty values', () => {
    const q = buildListQuery({ filter: { status: 'active', role: '', team: null } })
    expect(q.status).toBe('active')
    expect(q).not.toHaveProperty('role')
    expect(q).not.toHaveProperty('team')
  })
})

describe('defaultListMapper', () => {
  it.each([
    [[{ id: 1 }], 1],
    [{ data: [{ id: 1 }], meta: { total: 42 } }, 42],
    [{ items: [{ id: 1 }], total: 7 }, 7],
    [{ results: [{ id: 1 }], count: 3 }, 3],
    [{ rows: [{ id: 1 }], pagination: { total: 9 } }, 9],
  ])('unwraps %j', (raw, total) => {
    const result = defaultListMapper(raw)
    expect(result.rows).toHaveLength(1)
    expect(result.total).toBe(total)
  })

  it('says so loudly rather than returning an empty list', () => {
    // An empty table with no error is the worst possible failure here: it looks
    // like "no records" and sends people looking at their database.
    expect(() => defaultListMapper({ whatever: true })).toThrow(/map\.list/)
  })
})

describe('createRestDataProvider', () => {
  it('lists through the declared endpoint and naming', async () => {
    const { fetch, calls } = stubFetch([{ body: { data: [{ id: 1 }], meta: { total: 1 } } }])
    const provider = createRestDataProvider({ resources: [users], fetch, baseUrl: 'https://api.test' })

    const result = await provider.getList('users', { page: 2, perPage: 5, search: 'x' })
    expect(result).toEqual({ rows: [{ id: 1 }], total: 1 })
    expect(calls[0].url).toBe('https://api.test/api/users?page=2&per_page=5&q=x')
  })

  it('uses the declared verb for writes', async () => {
    const { fetch, calls } = stubFetch([{ body: { id: 1 } }, { body: { id: 1 } }, { status: 204 }])
    const provider = createRestDataProvider({ resources: [users], fetch })

    await provider.create('users', { data: { name: 'A' } })
    await provider.update('users', { id: 1, data: { name: 'B' } })
    await provider.remove('users', { id: 1 })

    expect(calls.map((c) => [c.init.method, c.url])).toEqual([
      ['POST', '/api/users'],
      ['PATCH', '/api/users/1'],
      ['DELETE', '/api/users/1'],
    ])
  })

  it('applies toWire before sending, with the operation name', async () => {
    const { fetch, calls } = stubFetch([{ body: {} }])
    const provider = createRestDataProvider({
      resources: [{ ...users, map: { toWire: (input, op) => ({ ...(input as object), op }) } }],
      fetch,
    })
    await provider.create('users', { data: { name: 'A' } })
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ name: 'A', op: 'create' })
  })

  it('calls arbitrary named endpoints', async () => {
    const { fetch, calls } = stubFetch([{ body: { ok: true } }])
    const provider = createRestDataProvider({ resources: [users], fetch })
    await provider.invoke('users', 'impersonate', { id: 9 })
    expect(calls[0].url).toBe('/api/users/9/impersonate')
    expect(calls[0].init.method).toBe('POST')
  })

  it('fans out getMany when there is no batch endpoint', async () => {
    const { fetch, calls } = stubFetch([{ body: { id: 1 } }, { body: { id: 2 } }])
    const provider = createRestDataProvider({ resources: [users], fetch })
    const rows = await provider.getMany('users', { ids: [1, 2] })
    expect(rows).toEqual([{ id: 1 }, { id: 2 }])
    expect(calls).toHaveLength(2)
  })

  it('uses a batch endpoint when one is declared', async () => {
    const { fetch, calls } = stubFetch([{ body: { data: [{ id: 1 }, { id: 2 }] } }])
    const provider = createRestDataProvider({
      resources: [{ ...users, endpoints: { ...users.endpoints, many: '/api/users/batch' } }],
      fetch,
    })
    await provider.getMany('users', { ids: [1, 2] })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('/api/users/batch?ids=1&ids=2')
  })

  it('names the resource and the operation when an endpoint is missing', async () => {
    const provider = createRestDataProvider({
      resources: [{ name: 'posts', endpoints: { list: '/api/posts' } }],
    })
    await expect(provider.getOne('posts', { id: 1 })).rejects.toThrow(/no "one" endpoint/)
    await expect(provider.getList('nope')).rejects.toThrow(/Unknown resource "nope"/)
  })

  it('normalizes error bodies, including field errors', async () => {
    const { fetch } = stubFetch([
      { status: 422, body: { message: 'Validation failed', errors: { email: ['taken'] } } },
    ])
    const provider = createRestDataProvider({ resources: [users], fetch })

    await expect(provider.create('users', { data: {} })).rejects.toMatchObject({
      message: 'Validation failed',
      status: 422,
      fields: { email: ['taken'] },
    })
  })

  it('lets a resource map its own error envelope', async () => {
    const { fetch } = stubFetch([{ status: 400, body: { detail: 'nope', invalid: { a: 'bad' } } }])
    const provider = createRestDataProvider({
      resources: [
        {
          ...users,
          map: { error: (raw: any) => ({ message: raw.detail, fields: raw.invalid }) },
        },
      ],
      fetch,
    })
    await expect(provider.create('users', { data: {} })).rejects.toMatchObject({
      message: 'nope',
      fields: { a: 'bad' },
    })
  })
})

describe('createHttpClient', () => {
  it('attaches the token', async () => {
    const { fetch, calls } = stubFetch([{ body: {} }])
    const client = createHttpClient({ fetch, getToken: () => 'abc' })
    await client.get('/x')
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer abc')
  })

  it('refreshes once and retries on 401', async () => {
    const { fetch } = stubFetch([{ status: 401 }, { body: { ok: true } }])
    const onUnauthorized = vi.fn(async () => true)
    const client = createHttpClient({ fetch, onUnauthorized })

    await expect(client.get('/x')).resolves.toEqual({ ok: true })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('refreshes once for a burst of concurrent 401s', async () => {
    // Six components mounting against a stale session must produce one refresh,
    // not six — which is what the single-flight guard exists for.
    const { fetch } = stubFetch([
      { status: 401 },
      { status: 401 },
      { status: 401 },
      { body: { ok: 1 } },
      { body: { ok: 2 } },
      { body: { ok: 3 } },
    ])
    let refreshes = 0
    const client = createHttpClient({
      fetch,
      onUnauthorized: async () => {
        refreshes++
        await new Promise((resolve) => setTimeout(resolve, 5))
        return true
      },
    })

    await Promise.all([client.get('/a'), client.get('/b'), client.get('/c')])
    expect(refreshes).toBe(1)
  })

  it('gives up after one retry', async () => {
    const { fetch } = stubFetch([{ status: 401 }, { status: 401 }])
    const client = createHttpClient({ fetch, onUnauthorized: async () => true })
    await expect(client.get('/x')).rejects.toBeInstanceOf(HttpError)
  })

  it('treats 204 as no content', async () => {
    const { fetch } = stubFetch([{ status: 204 }])
    const client = createHttpClient({ fetch })
    await expect(client.get('/x')).resolves.toBeUndefined()
  })
})

describe('DataStore', () => {
  it('dedupes concurrent fetches for one key', async () => {
    const store = new DataStore()
    let calls = 0
    const fetcher = async () => {
      calls++
      await new Promise((resolve) => setTimeout(resolve, 5))
      return 'value'
    }
    await Promise.all([store.fetch('k', fetcher), store.fetch('k', fetcher), store.fetch('k', fetcher)])
    expect(calls).toBe(1)
    expect(store.peek('k').data).toBe('value')
  })

  it('serves fresh data from cache and refetches once stale', async () => {
    let time = 1000
    const store = new DataStore({ staleTime: 100, now: () => time })
    let calls = 0
    const fetcher = async () => `v${++calls}`

    await store.fetch('k', fetcher)
    await store.fetch('k', fetcher)
    expect(calls).toBe(1)

    time += 200
    await store.fetch('k', fetcher)
    expect(calls).toBe(2)
  })

  it('records the error and keeps it readable', async () => {
    const store = new DataStore()
    await expect(store.fetch('k', async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    expect(store.peek('k').status).toBe('error')
  })

  it('notifies subscribers and stops after unsubscribe', async () => {
    const store = new DataStore()
    let notifications = 0
    const unsubscribe = store.subscribe('k', () => notifications++)
    await store.fetch('k', async () => 1)
    expect(notifications).toBeGreaterThan(0)

    const before = notifications
    unsubscribe()
    store.set('k', 2)
    expect(notifications).toBe(before)
  })

  it('invalidates by prefix and refetches watched keys', async () => {
    const store = new DataStore()
    let calls = 0
    const fetcher = async () => ++calls

    store.subscribe('users|list|{}', () => {})
    await store.fetch('users|list|{}', fetcher)
    await store.fetch('posts|list|{}', async () => 'posts')
    expect(calls).toBe(1)

    store.invalidate('users|')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls).toBe(2)
    expect(store.peek('posts|list|{}').data).toBe('posts')
  })

  it('rolls an optimistic update back to the previous value', () => {
    const store = new DataStore()
    store.set('one', { id: 1, name: 'A' })
    const previous = store.update<{ id: number; name: string }>('one', (current) => ({
      ...current!,
      name: 'B',
    }))
    expect(store.peek<{ name: string }>('one').data?.name).toBe('B')
    store.set('one', previous)
    expect(store.peek<{ name: string }>('one').data?.name).toBe('A')
  })

  it('replaces the snapshot object on every change', async () => {
    // Load-bearing, not cosmetic: useSyncExternalStore compares snapshots with
    // Object.is, so an entry mutated in place is invisible to React and every
    // subscribed component stays stuck on its first render — which is exactly
    // what a table permanently showing skeletons looks like.
    const store = new DataStore()
    const before = store.peek('k')
    await store.fetch('k', async () => 'value')
    const after = store.peek('k')

    expect(before).not.toBe(after)
    expect(after.data).toBe('value')

    store.set('k', 'other')
    expect(store.peek('k')).not.toBe(after)
  })

  it('returns a stable identity when nothing has changed', () => {
    // The other half of the contract: re-reading without a change must return
    // the same object, or every render is a new snapshot and React loops.
    const store = new DataStore()
    store.set('k', 1)
    expect(store.peek('k')).toBe(store.peek('k'))
  })

  it('clears entries, which is what logout needs', () => {
    const store = new DataStore()
    store.set('users|list|{}', [1])
    store.clear()
    expect(store.peek('users|list|{}').data).toBeUndefined()
  })
})

describe('cache keys', () => {
  it('is stable regardless of key order', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }))
    expect(cacheKey('users', 'list', { page: 1, sort: 'name' })).toBe(
      cacheKey('users', 'list', { sort: 'name', page: 1 }),
    )
  })

  it('ignores undefined values so an unset filter is not a different key', () => {
    expect(cacheKey('users', 'list', { page: 1, search: undefined })).toBe(
      cacheKey('users', 'list', { page: 1 }),
    )
  })

  it('separates resources and operations', () => {
    expect(cacheKey('users', 'one', 1)).not.toBe(cacheKey('posts', 'one', 1))
    expect(cacheKey('users', 'one', 1)).not.toBe(cacheKey('users', 'list', 1))
  })
})
