import { describe, expect, it } from 'vitest'
import { createAccessEngine, expandRoles, matchesPattern } from '../src/access/engine'
import { atLeast, strongest, toAccessLevel, toPermissionsMap } from '../src/access/levels'
import type { AccessSnapshot } from '../src/access/types'

function snapshot(partial: Partial<AccessSnapshot> = {}): AccessSnapshot {
  return { permissions: {}, entitlements: null, roles: [], isAdmin: false, ...partial }
}

describe('matchesPattern', () => {
  it.each([
    ['*', 'users:create', true],
    ['users:*', 'users:create', true],
    ['users:*', 'billing:create', false],
    ['*:list', 'users:list', true],
    ['*:list', 'users:create', false],
    ['users:create', 'users:create', true],
    ['users:create', 'users:createx', false],
    ['users:*', 'users', false],
    ['users:*', 'users:a:b', true],
    ['users', 'users:create', false],
  ])('%s vs %s → %s', (pattern, code, expected) => {
    expect(matchesPattern(pattern, code)).toBe(expected)
  })
})

describe('levels', () => {
  it('orders none < view < full', () => {
    expect(atLeast('view', 'view')).toBe(true)
    expect(atLeast('full', 'view')).toBe(true)
    expect(atLeast('view', 'full')).toBe(false)
    expect(atLeast(undefined, 'view')).toBe(false)
    expect(atLeast('none', 'none')).toBe(true)
  })

  it('takes the strongest of a set', () => {
    expect(strongest(['none', 'view', 'none'])).toBe('view')
    expect(strongest(['view', 'full'])).toBe('full')
    expect(strongest([])).toBe('none')
    expect(strongest([undefined, undefined])).toBe('none')
  })

  it('normalizes the shapes backends actually send', () => {
    expect(toAccessLevel('full')).toBe('full')
    expect(toAccessLevel(true)).toBe('full')
    expect(toAccessLevel(false)).toBe('none')
    expect(toAccessLevel(null)).toBe('none')
    expect(toAccessLevel(2)).toBe('full')
    expect(toAccessLevel(1)).toBe('view')
    expect(toAccessLevel('read')).toBe('view')
    expect(toAccessLevel('write')).toBe('full')
    expect(toAccessLevel({ read: true })).toBe('view')
    expect(toAccessLevel({ level: 'full' })).toBe('full')
    expect(toAccessLevel('nonsense')).toBe('none')
  })

  it('normalizes a permission payload from a map or a grant list', () => {
    expect(toPermissionsMap({ USERS: 'view', BILLING: true })).toEqual({
      USERS: 'view',
      BILLING: 'full',
    })
    expect(toPermissionsMap(['users:list', 'users:create'])).toEqual({
      'users:list': 'full',
      'users:create': 'full',
    })
    expect(toPermissionsMap([{ code: 'USERS', level: 'view' }])).toEqual({ USERS: 'view' })
    expect(toPermissionsMap(null)).toEqual({})
  })
})

describe('expandRoles', () => {
  it('follows hierarchy transitively', () => {
    const { roles, grants } = expandRoles(['admin'], {
      hierarchy: { admin: ['editor'], editor: ['viewer'] },
      roles: { admin: ['admin:*'], editor: ['posts:*'], viewer: ['*:list'] },
    })
    expect(roles.sort()).toEqual(['admin', 'editor', 'viewer'])
    expect(grants.sort()).toEqual(['*:list', 'admin:*', 'posts:*'])
  })

  it('survives a cyclic hierarchy', () => {
    // A config typo should not take every page down.
    const { roles } = expandRoles(['a'], { hierarchy: { a: ['b'], b: ['a'] } })
    expect(roles.sort()).toEqual(['a', 'b'])
  })
})

describe('createAccessEngine', () => {
  it('reads levels straight from the permission map', () => {
    const engine = createAccessEngine(snapshot({ permissions: { USERS: 'view', BILLING: 'full' } }))
    expect(engine.levelFor('USERS')).toBe('view')
    expect(engine.can('USERS')).toBe(true)
    expect(engine.can('USERS', 'full')).toBe(false)
    expect(engine.can('BILLING', 'full')).toBe(true)
    expect(engine.levelFor('UNKNOWN')).toBe('none')
  })

  it('supports wildcard keys in the map itself', () => {
    const engine = createAccessEngine(snapshot({ permissions: { '*:list': 'view' } }))
    expect(engine.can('users:list')).toBe(true)
    expect(engine.can('users:create')).toBe(false)
  })

  it('grants everything to an administrator', () => {
    const engine = createAccessEngine(snapshot({ roles: ['admin'], permissions: {} }))
    expect(engine.isAdmin).toBe(true)
    expect(engine.can('anything:at:all', 'full')).toBe(true)
  })

  it('lets deny beat every grant, including admin', () => {
    const engine = createAccessEngine(
      snapshot({ roles: ['admin'], permissions: { 'users:delete': 'full' } }),
      { deny: { admin: ['users:delete'] } },
    )
    expect(engine.can('users:delete')).toBe(false)
    expect(engine.can('users:create')).toBe(true)
  })

  it('does not inherit denials up the hierarchy', () => {
    // Inheritance accumulates capability. If it also inherited restrictions,
    // adding `hierarchy: { admin: ['manager'] }` would silently strip
    // `users:delete` from admins because managers are denied it.
    const config = {
      roles: { admin: ['*'], manager: ['users:*'] },
      hierarchy: { admin: ['manager'] },
      deny: { manager: ['users:delete'] },
    }
    const asAdmin = createAccessEngine(snapshot({ roles: ['admin'], permissions: null }), config)
    const asManager = createAccessEngine(snapshot({ roles: ['manager'], permissions: null }), config)

    expect(asAdmin.can('users:delete', 'full')).toBe(true)
    expect(asManager.can('users:delete', 'full')).toBe(false)
    expect(asManager.can('users:update', 'full')).toBe(true)
  })

  it('still applies a denial to someone holding both roles directly', () => {
    const engine = createAccessEngine(
      snapshot({ roles: ['admin', 'manager'], permissions: null }),
      { roles: { admin: ['*'] }, deny: { manager: ['users:delete'] } },
    )
    expect(engine.can('users:delete')).toBe(false)
  })

  it('expands roles into grants when the backend sends roles only', () => {
    const engine = createAccessEngine(
      snapshot({ roles: ['editor'], permissions: null }),
      { roles: { editor: ['posts:*'] } },
    )
    expect(engine.can('posts:update', 'full')).toBe(true)
    // Role grants are the source of truth here, so an unlisted code is denied
    // rather than falling through to the fail-open branch.
    expect(engine.can('users:delete')).toBe(false)
  })

  it('fails open when the permission source could not be read', () => {
    const engine = createAccessEngine(snapshot({ permissions: null }))
    expect(engine.can('anything', 'full')).toBe(true)
  })

  it('fails closed when told to', () => {
    const engine = createAccessEngine(snapshot({ permissions: null }), {
      permissions: { onUnavailable: 'deny' },
    })
    expect(engine.can('anything')).toBe(false)
  })

  it('distinguishes "granted nothing" from "could not be read"', () => {
    // An empty map is an answer: the user has nothing. A null map is silence.
    expect(createAccessEngine(snapshot({ permissions: {} })).can('users:list')).toBe(false)
    expect(createAccessEngine(snapshot({ permissions: null })).can('users:list')).toBe(true)
  })

  it('takes the strongest level across merged accessCodes', () => {
    const engine = createAccessEngine(
      snapshot({ permissions: { BILLING: 'view', CLAIMS: 'full' } }),
    )
    expect(engine.levelForModule({ code: 'BILLING', accessCodes: ['CLAIMS'] })).toBe('full')
    expect(engine.levelForModule({ code: 'BILLING' })).toBe('view')
  })

  describe('entitlement axis', () => {
    it('is unconstrained when there is no entitlement list', () => {
      const engine = createAccessEngine(snapshot({ entitlements: null }))
      expect(engine.entitled('WARD')).toBe(true)
    })

    it('gates on the list when there is one', () => {
      const engine = createAccessEngine(snapshot({ entitlements: ['BILLING'] }))
      expect(engine.entitled('BILLING')).toBe(true)
      expect(engine.entitled('WARD')).toBe(false)
    })

    it('can be told to fail closed', () => {
      const engine = createAccessEngine(snapshot({ entitlements: null }), {
        entitlements: { onUnavailable: 'deny' },
      })
      expect(engine.entitled('BILLING')).toBe(false)
    })

    it('overrides permission — an unentitled module is invisible even to an admin', () => {
      // The two axes answer different questions. A tenant that does not run a
      // module has no such page, regardless of who is asking.
      const engine = createAccessEngine(
        snapshot({ roles: ['admin'], entitlements: ['BILLING'] }),
      )
      expect(engine.can('WARD', 'full')).toBe(true)
      expect(engine.moduleVisible({ code: 'WARD' })).toBe(false)
      expect(engine.moduleVisible({ code: 'BILLING' })).toBe(true)
    })
  })

  it('honours a per-module required level', () => {
    const engine = createAccessEngine(snapshot({ permissions: { REPORTS: 'view' } }))
    expect(engine.moduleVisible({ code: 'REPORTS' })).toBe(true)
    expect(engine.moduleVisible({ code: 'REPORTS', requiredLevel: 'full' })).toBe(false)
  })
})
