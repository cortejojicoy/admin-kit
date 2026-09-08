/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

// The kit's client code imports next/navigation and next/link. Neither resolves
// outside a Next build, and neither is what these tests are about.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), pathname: '/', query: {} }),
}))

const { AdminProvider } = await import('../src/AdminProvider')
const { AppShell } = await import('../src/ui/launcher/AppShell')
const { AppLauncher } = await import('../src/ui/launcher/AppLauncher')
const { AdminShell } = await import('../src/ui/admin/AdminShell')
const { ResourceTable } = await import('../src/ui/data/ResourceTable')
const { Can } = await import('../src/access/AccessProvider')
const { useAdminConfig } = await import('../src/context/AdminConfigContext')
const { defineAdminConfig } = await import('../src/config/defineConfig')
import type { AccessSnapshot } from '../src/access/types'
import type { DataProvider } from '../src/data/types'

const config = defineAdminConfig({
  app: { name: 'Acme' },
  auth: {
    provider: 'jwt',
    jwt: { endpoints: { login: '/api/login', me: '/api/me' }, tokenStorage: 'memory' },
  },
  modules: [
    { code: 'USERS', title: 'Users', href: '/users', iconKey: 'users', emphasis: 'primary' },
    { code: 'ALERTS', title: 'Alerts', href: '/alerts', emphasis: 'critical' },
    { code: 'REPORTS', title: 'Reports', href: '/reports' },
    { code: 'LABS', title: 'Labs', href: '/labs', placement: 'dock' },
  ],
  navigation: {
    sections: [
      {
        id: 'main',
        label: 'Main',
        items: [
          { label: 'Overview', href: '/admin' },
          { label: 'Users', href: '/admin/users', permissions: ['users:list'] },
        ],
      },
    ],
  },
  resources: [
    {
      name: 'users',
      endpoints: { list: '/api/users', one: '/api/users/:id' },
      fields: [
        { name: 'id', label: 'ID' },
        { name: 'email', type: 'email' },
        { name: 'active', type: 'boolean' },
      ],
      permissions: { list: 'users:list' },
    },
  ],
})

function snapshot(partial: Partial<AccessSnapshot> = {}): AccessSnapshot {
  return { permissions: {}, entitlements: null, roles: [], isAdmin: false, ...partial }
}

/** Loosely typed so a double can return a concrete row shape without generics. */
type ProviderDouble = Partial<Record<keyof DataProvider, (...args: never[]) => unknown>>

function wrap(
  ui: ReactNode,
  options: { snapshot?: AccessSnapshot; dataProvider?: ProviderDouble } = {},
) {
  const provider = {
    getList: async () => ({ rows: [], total: 0 }),
    getOne: async () => ({}),
    getMany: async () => [],
    create: async () => ({}),
    update: async () => ({}),
    remove: async () => undefined,
    invoke: async () => undefined,
    ...options.dataProvider,
  } as DataProvider

  return render(
    <AdminProvider
      config={config}
      snapshot={options.snapshot ?? snapshot({ permissions: null })}
      initialSession={{ user: { id: '1', name: 'Ada' } }}
      dataProvider={provider}
    >
      {ui}
    </AdminProvider>,
  )
}

// RTL's automatic cleanup only registers when vitest globals are enabled, and
// they are not here — without this every render accumulates in document.body
// and queries start matching the previous test's markup.
afterEach(cleanup)

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ id: '1', name: 'Ada' }), {
      headers: { 'Content-Type': 'application/json' },
    }),
  )
})

describe('AdminProvider', () => {
  it('exposes the resolved config through context', () => {
    function Probe() {
      const resolved = useAdminConfig()
      return <span data-testid="home">{resolved.panels.app.home}</span>
    }
    wrap(<Probe />)
    expect(screen.getByTestId('home').textContent).toBe('/dashboard')
  })

  it('tells you what is missing when a hook is used outside it', () => {
    function Probe() {
      useAdminConfig()
      return null
    }
    // React logs the thrown error; silence it so the run stays readable.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(/must be used inside <AdminProvider>/)
    spy.mockRestore()
  })
})

describe('AppShell + AppLauncher', () => {
  it('renders the brand, the greeting and the tiles', () => {
    wrap(
      <AppShell>
        <AppLauncher />
      </AppShell>,
    )
    expect(screen.getByText('Acme')).toBeTruthy()
    expect(screen.getByText(/Ada/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Users' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Reports' })).toBeTruthy()
  })

  it('puts dock modules in the dock, not the tile grid', () => {
    wrap(<AppLauncher />)
    // Labs is declared `placement: 'dock'`, so it is a quick-access cell.
    expect(screen.queryByRole('heading', { name: 'Labs' })).toBeNull()
    const dock = screen.getByRole('navigation', { name: 'Quick access' })
    expect(dock.textContent).toContain('Labs')
  })

  it('uses the featured layout only when both emphasis modules are granted', () => {
    const { container } = wrap(<AppLauncher />, { snapshot: snapshot({ permissions: null }) })
    expect(container.querySelector('.ak-hub__featured')).not.toBeNull()

    // Deny the critical module: the layout must degrade to an even grid rather
    // than leaving a two-thirds tile beside a gap.
    const { container: partial } = wrap(<AppLauncher />, {
      snapshot: snapshot({ permissions: { USERS: 'full', REPORTS: 'full' } }),
    })
    expect(partial.querySelector('.ak-hub__featured')).toBeNull()
    expect(partial.querySelector('.ak-hub__grid')).not.toBeNull()
  })

  it('filters tiles by permission', () => {
    wrap(<AppLauncher />, { snapshot: snapshot({ permissions: { USERS: 'view' } }) })
    expect(screen.getByRole('heading', { name: 'Users' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Reports' })).toBeNull()
  })

  it('hides everything a tenant is not entitled to, even from an admin', () => {
    wrap(<AppLauncher />, { snapshot: snapshot({ isAdmin: true, entitlements: ['USERS'] }) })
    expect(screen.getByRole('heading', { name: 'Users' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Reports' })).toBeNull()
  })

  it('says so plainly when no module is granted', () => {
    wrap(<AppLauncher />, { snapshot: snapshot({ permissions: {} }) })
    expect(screen.getByText(/do not have access to any modules/i)).toBeTruthy()
  })
})

describe('AdminShell', () => {
  it('renders the filtered sidebar and the back link', () => {
    wrap(<AdminShell>content</AdminShell>, { snapshot: snapshot({ permissions: null }) })
    expect(screen.getByText('content')).toBeTruthy()
    expect(screen.getByText('Overview')).toBeTruthy()
    expect(screen.getByText('Back to app')).toBeTruthy()
  })

  it('drops sidebar items the user lacks permission for', () => {
    wrap(<AdminShell>content</AdminShell>, { snapshot: snapshot({ permissions: {} }) })
    expect(screen.getByText('Overview')).toBeTruthy()
    // 'Users' as a sidebar entry requires users:list.
    const links = screen.getAllByRole('link').map((a) => a.textContent)
    expect(links).not.toContain('Users')
  })

  it('has no search field, unlike the app panel', () => {
    // Search in this kit looks up records, which means nothing on a config page.
    const { container } = wrap(<AdminShell>content</AdminShell>)
    expect(container.querySelector('.ak-search')).toBeNull()
  })
})

describe('Can', () => {
  it('renders children only when permitted', () => {
    wrap(
      <>
        <Can do="users:create">
          <span>create</span>
        </Can>
        <Can do="users:delete" fallback={<span>denied</span>}>
          <span>delete</span>
        </Can>
      </>,
      { snapshot: snapshot({ permissions: { 'users:create': 'full' } }) },
    )
    expect(screen.getByText('create')).toBeTruthy()
    expect(screen.getByText('denied')).toBeTruthy()
    expect(screen.queryByText('delete')).toBeNull()
  })
})

describe('ResourceTable', () => {
  it('builds columns and rows from the resource descriptor', async () => {
    wrap(<ResourceTable resource="users" />, {
      snapshot: snapshot({ permissions: { 'users:list': 'full' } }),
      dataProvider: {
        getList: async () => ({
          rows: [{ id: '1', email: 'ada@test', active: true }],
          total: 1,
        }),
      },
    })

    await waitFor(() => expect(screen.getByText('ada@test')).toBeTruthy())
    expect(screen.getByRole('columnheader', { name: 'ID' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Email' })).toBeTruthy()
    expect(screen.getByText('Yes')).toBeTruthy() // boolean formatting
    expect(screen.getByText('1 record')).toBeTruthy()
  })

  it('does not fetch a list the user may not read', async () => {
    const getList = vi.fn(async () => ({ rows: [], total: 0 }))
    wrap(<ResourceTable resource="users" />, {
      snapshot: snapshot({ permissions: {} }),
      dataProvider: { getList },
    })

    expect(screen.getByText(/do not have permission/i)).toBeTruthy()
    // A table the user may not read should not issue the request that will 403.
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(getList).not.toHaveBeenCalled()
  })

  it('surfaces a list error instead of showing an empty table', async () => {
    wrap(<ResourceTable resource="users" />, {
      snapshot: snapshot({ permissions: { 'users:list': 'full' } }),
      dataProvider: {
        getList: async () => {
          throw new Error('backend exploded')
        },
      },
    })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('backend exploded'))
  })

  it('accepts a serializable href template, so a server page can render it', async () => {
    // The function form of `hrefFor` cannot be passed from a server component,
    // which would quietly force every list page to become a client component.
    wrap(<ResourceTable resource="users" hrefFor="/admin/users/:id" />, {
      snapshot: snapshot({ permissions: null }),
      dataProvider: {
        getList: async () => ({ rows: [{ id: '7', email: 'x@y.z' }], total: 1 }),
      },
    })
    await waitFor(() => expect(screen.getByText('7')).toBeTruthy())
    expect(screen.getByRole('link', { name: '7' }).getAttribute('href')).toBe('/admin/users/7')
  })

  it('hides the delete control when the resource has no remove endpoint', async () => {
    wrap(<ResourceTable resource="users" />, {
      snapshot: snapshot({ permissions: null }),
      dataProvider: { getList: async () => ({ rows: [{ id: '1' }], total: 1 }) },
    })
    await waitFor(() => expect(screen.getByText('1 record')).toBeTruthy())
    expect(screen.queryByLabelText(/^Delete/)).toBeNull()
  })
})
