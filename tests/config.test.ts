import { describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config/defaults'
import { findUnserializable, serializeConfig } from '../src/config/serialize'
import { buildModules, catalogFromDescriptors, dockModules, tileModules } from '../src/modules/catalog'
import { copyFor } from '../src/modules/types'
import { createPluginRegistry } from '../src/modules/registry'
import type { AdminConfig } from '../src/config/types'
import type { ModuleDescriptor } from '../src/modules/types'

const base: AdminConfig = {
  app: { name: 'Acme' },
  auth: { provider: 'jwt', jwt: { endpoints: { login: '/l', me: '/m' } } },
}

describe('resolveConfig', () => {
  it('fills defaults without touching what was set', () => {
    const resolved = resolveConfig(base)
    expect(resolved.router).toBe('app')
    expect(resolved.auth.loginPage.path).toBe('/login')
    expect(resolved.auth.loginPage.title).toBe('Sign in to Acme')
    expect(resolved.panels.app.home).toBe('/dashboard')
    expect(resolved.panels.admin.basePath).toBe('/admin')
    expect(resolved.layout.sidebarPosition).toBe('left')
    expect(resolved.modules).toEqual([])
    expect(resolved.resources).toEqual([])
  })

  it('sends the user to the app home after login by default', () => {
    expect(resolveConfig(base).auth.afterLoginRedirect).toBe('/dashboard')
    expect(
      resolveConfig({ ...base, panels: { app: { home: '/hub' } } }).auth.afterLoginRedirect,
    ).toBe('/hub')
  })

  it('does not override explicit values', () => {
    const resolved = resolveConfig({
      ...base,
      router: 'pages',
      auth: { ...base.auth, loginPage: { path: '/sign-in', title: 'Hello' }, afterLoginRedirect: '/x' },
      layout: { sidebarPosition: 'right' },
    })
    expect(resolved.router).toBe('pages')
    expect(resolved.auth.loginPage.path).toBe('/sign-in')
    expect(resolved.auth.loginPage.title).toBe('Hello')
    expect(resolved.auth.afterLoginRedirect).toBe('/x')
    expect(resolved.layout.sidebarPosition).toBe('right')
  })

  it('points "back to app" at the app home', () => {
    const resolved = resolveConfig({ ...base, panels: { app: { home: '/hub' } } })
    expect(resolved.panels.admin.backTo).toBe('/hub')
  })
})

describe('serializeConfig', () => {
  const withFunctions: AdminConfig = {
    ...base,
    auth: {
      ...base.auth,
      jwt: { endpoints: { login: '/l', me: '/m' }, secret: 'super-secret', mapUser: (raw) => raw as never },
      custom: { name: 'x', login: async () => ({ user: { id: '1' } }), logout: async () => {}, getSession: async () => null },
    },
    plugins: [{ id: 'p', Provider: (({ children }: never) => children) as never }],
    resources: [
      { name: 'users', endpoints: { list: '/api/users' }, map: { one: (raw) => raw } },
    ],
  }

  it('strips everything that cannot cross the RSC boundary', () => {
    const result = serializeConfig(withFunctions)
    expect(findUnserializable(result)).toEqual([])
  })

  it('removes the secret even though it should never have been there', () => {
    const result = serializeConfig(withFunctions)
    expect(result.auth.jwt).not.toHaveProperty('secret')
    expect(JSON.stringify(result)).not.toContain('super-secret')
  })

  it('keeps the declarative parts intact', () => {
    const result = serializeConfig(withFunctions)
    expect(result.auth.jwt?.endpoints.login).toBe('/l')
    expect(result.resources?.[0].endpoints.list).toBe('/api/users')
    expect(result.resources?.[0]).not.toHaveProperty('map')
  })

  it('survives a round trip through JSON, which is what the boundary does', () => {
    const result = serializeConfig(withFunctions)
    expect(JSON.parse(JSON.stringify(result))).toEqual(JSON.parse(JSON.stringify(result)))
  })
})

describe('findUnserializable', () => {
  it('reports the path to each offender', () => {
    const found = findUnserializable({
      a: 1,
      b: () => {},
      c: { d: [{ e: () => {} }] },
    })
    expect(found).toEqual(['config.b', 'config.c.d[0].e'])
  })

  it('does not loop on a cycle', () => {
    const cyclic: Record<string, unknown> = { a: 1 }
    cyclic.self = cyclic
    expect(findUnserializable(cyclic)).toEqual([])
  })
})

describe('buildModules', () => {
  const descriptors: ModuleDescriptor[] = [
    { code: 'A', title: 'Alpha', href: '/a', order: 2 },
    { code: 'B', title: 'Beta', href: '/b', order: 1 },
    { code: 'C', title: 'Gamma', href: '/c', placement: 'dock' },
  ]

  it('intersects the catalog with the descriptors', () => {
    const result = buildModules([{ code: 'A' }, { code: 'ZZ' }], descriptors)
    expect(result.map((m) => m.code)).toEqual(['A'])
  })

  it('drops inactive catalog entries', () => {
    const result = buildModules([{ code: 'A', active: false }, { code: 'B' }], descriptors)
    expect(result.map((m) => m.code)).toEqual(['B'])
  })

  it('lets the backend own the title and the frontend own presentation', () => {
    const [module] = buildModules([{ code: 'A', title: 'Renamed upstream' }], descriptors)
    expect(module.title).toBe('Renamed upstream')
    expect(module.href).toBe('/a')
  })

  it('falls back to the descriptors when the catalog cannot be read', () => {
    // Navigation that goes blank because a status endpoint hiccuped is worse
    // than navigation showing a module the user turns out not to have.
    const result = buildModules(null, descriptors)
    expect(result.map((m) => m.code)).toEqual(['C', 'B', 'A'])
  })

  it('applies the entitlement gate when one is supplied', () => {
    const result = buildModules(null, descriptors, { entitled: (code) => code !== 'A' })
    expect(result.map((m) => m.code)).not.toContain('A')
  })

  it('resolves per-flavour copy', () => {
    const [module] = buildModules(null, [
      {
        code: 'V',
        title: 'Vitals',
        href: '/v',
        description: { default: 'Readings.', clinic: 'Taken at the desk.' },
      },
    ], { flavor: 'clinic' })
    expect(module.description).toBe('Taken at the desk.')
  })

  it('falls back to default copy for an unknown flavour', () => {
    expect(copyFor({ default: 'D', clinic: 'C' }, 'hospital')).toBe('D')
    expect(copyFor('plain', 'clinic')).toBe('plain')
    expect(copyFor(undefined)).toBeUndefined()
  })

  it('treats a missing order as 0, the same neutral default sections use', () => {
    // C has no order, so it sorts with 0 — ahead of B (1) and A (2). One rule
    // for modules and sections beats two that disagree.
    expect(buildModules(null, descriptors).map((m) => m.code)).toEqual(['C', 'B', 'A'])
  })

  it('keeps declaration order among equal orders', () => {
    const same: ModuleDescriptor[] = [
      { code: 'X', title: 'X', href: '/x', order: 1 },
      { code: 'Y', title: 'Y', href: '/y', order: 1 },
    ]
    expect(buildModules(null, same).map((m) => m.code)).toEqual(['X', 'Y'])
  })

  it('splits tiles from dock cells', () => {
    const built = buildModules(null, descriptors)
    expect(tileModules(built).map((m) => m.code)).toEqual(['B', 'A'])
    expect(tileModules(built).map((m) => m.code)).not.toContain('C')
    expect(dockModules(built).map((m) => m.code)).toEqual(['C'])
  })

  it('orders the dock by config, not by catalog', () => {
    // The cell under the user's thumb must not move when a seed file is
    // reordered upstream.
    const docked: ModuleDescriptor[] = [
      { code: 'X', title: 'X', href: '/x', placement: 'dock' },
      { code: 'Y', title: 'Y', href: '/y', placement: 'dock' },
      { code: 'Z', title: 'Z', href: '/z', placement: 'dock' },
    ]
    expect(dockModules(docked, ['Z', 'X']).map((m) => m.code)).toEqual(['Z', 'X', 'Y'])
  })

  it('derives a fallback catalog from the descriptors', () => {
    expect(catalogFromDescriptors(descriptors)).toEqual([
      { code: 'A', title: 'Alpha', order: 2, active: true },
      { code: 'B', title: 'Beta', order: 1, active: true },
      { code: 'C', title: 'Gamma', order: undefined, active: true },
    ])
  })
})

describe('createPluginRegistry', () => {
  const Widget = () => null

  it('returns a usable component from the widget lookup', () => {
    // v0.1.x typed this through a conditional that resolved to `never`, so the
    // component could not be rendered by anyone.
    const registry = createPluginRegistry([{ id: 'p', widgets: { dashboard: Widget } }])
    const widgets = registry.widgets('dashboard')
    expect(widgets).toHaveLength(1)
    expect(widgets[0].Component).toBe(Widget)
    expect(widgets[0].pluginId).toBe('p')
  })

  it('skips plugins whose enabled predicate is false', () => {
    const registry = createPluginRegistry(
      [
        { id: 'admin-only', enabled: ({ isAdmin }) => isAdmin, widgets: { x: Widget } },
        { id: 'always', widgets: { x: Widget } },
      ],
      { roles: ['viewer'], isAdmin: false },
    )
    expect(registry.all.map((p) => p.id)).toEqual(['always'])
    expect(registry.widgets('x')).toHaveLength(1)
  })

  it('returns providers in declaration order', () => {
    const A = (({ children }: never) => children) as never
    const B = (({ children }: never) => children) as never
    const registry = createPluginRegistry([{ id: 'a', Provider: A }, { id: 'b', Provider: B }])
    expect(registry.providers()).toEqual([A, B])
  })

  it('returns an empty list for an unknown slot', () => {
    expect(createPluginRegistry([]).widgets('nope')).toEqual([])
  })
})
