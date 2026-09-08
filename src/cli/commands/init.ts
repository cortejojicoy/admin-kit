import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface InitOptions {
  cwd?: string
  /** `app` (default) or `pages`. */
  router?: 'app' | 'pages'
  name?: string
  force?: boolean
}

interface Template {
  path: string
  content: string
}

/**
 * Scaffold a working installation.
 *
 * Writes the two config files — the serializable one and the server-only one —
 * plus the login route, the middleware, and one page per panel. It refuses to
 * overwrite anything unless `--force` is passed, so running it in an existing
 * project is safe.
 */
export function runInit(options: InitOptions = {}): number {
  const cwd = options.cwd ?? process.cwd()
  const router = options.router ?? 'app'
  const name = options.name ?? 'Admin'

  const templates = router === 'app' ? appTemplates(name) : pagesTemplates(name)

  const skipped: string[] = []
  const written: string[] = []

  for (const template of templates) {
    const target = join(cwd, template.path)
    if (existsSync(target) && !options.force) {
      skipped.push(template.path)
      continue
    }
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, template.content, 'utf8')
    written.push(template.path)
  }

  for (const path of written) console.log(`  created  ${path}`)
  for (const path of skipped) console.log(`  skipped  ${path} (exists — pass --force to overwrite)`)

  console.log(`
Next steps:
  1. Set JWT_SECRET in .env.local
  2. Point admin.config.ts at your real API endpoints
  3. Run \`npx admin-kit docs\` to generate docs for your config
`)
  return 0
}

const PKG = '@cortejojicoy/admin-kit'

function configTemplate(name: string, router: 'app' | 'pages'): string {
  return `import { defineAdminConfig } from '${PKG}'

/**
 * Serializable configuration.
 *
 * Everything here is plain data so it can be built on the server — where the
 * session and the user's permissions already are — and handed to a client
 * component. Keep functions and secrets out; see admin.server.ts.
 */
export const adminConfig = defineAdminConfig({
  app: {
    name: '${name}',
    logoIconKey: 'grid',
    description: 'Here is your overview for today.',
  },
  router: '${router}',

  auth: {
    provider: 'jwt',
    jwt: {
      endpoints: {
        login: '/api/auth/login',
        me: '/api/auth/me',
        logout: '/api/auth/logout',
      },
      // The login route sets an HttpOnly cookie; the browser never holds the
      // token, so an XSS cannot read the session.
      tokenStorage: 'server-cookie',
      cookieName: 'session',
    },
    loginPage: { path: '/login', subtitle: 'Sign in to continue' },
    publicRoutes: ['/login', '/api/auth'],
  },

  access: {
    // Roles are only needed when your backend sends roles rather than
    // permissions. Remove this if /api/me/permissions returns a permission map.
    roles: {
      admin: ['*'],
      editor: ['users:list', 'users:read', 'users:update'],
      viewer: ['*:list', '*:read'],
    },
    adminRoles: ['admin'],
    permissions: {
      endpoint: '/api/me/permissions',
      // Fail open: a permissions endpoint returning 503 must not lock everyone
      // out of the app. Switch to 'deny' if you would rather fail closed.
      onUnavailable: 'allow',
    },
  },

  modules: [
    {
      code: 'USERS',
      title: 'Users',
      description: 'Accounts, roles and access.',
      href: '/users',
      iconKey: 'users',
      placement: 'tile',
      emphasis: 'primary',
    },
    {
      code: 'REPORTS',
      title: 'Reports',
      description: 'Operational reporting.',
      href: '/reports',
      iconKey: 'activity',
      placement: 'tile',
    },
  ],

  resources: [
    {
      name: 'users',
      label: 'User',
      labelPlural: 'Users',
      endpoints: {
        list: '/api/users',
        one: '/api/users/:id',
        create: { method: 'POST', path: '/api/users' },
        update: { method: 'PATCH', path: '/api/users/:id' },
        remove: { method: 'DELETE', path: '/api/users/:id' },
      },
      query: { page: 'page', perPage: 'per_page', search: 'q' },
      fields: [
        { name: 'id', label: 'ID', readOnly: true, sortable: true },
        { name: 'name', required: true, sortable: true },
        { name: 'email', type: 'email', required: true, sortable: true },
        { name: 'active', type: 'boolean' },
      ],
      permissions: {
        list: 'users:list',
        one: 'users:read',
        create: 'users:create',
        update: 'users:update',
        remove: 'users:delete',
      },
    },
  ],

  panels: {
    app: { home: '/dashboard' },
    admin: { basePath: '/admin', title: '${name} admin' },
  },
})
`
}

const SERVER_CONFIG = `import { defineAdminServerConfig } from '${PKG}'

/**
 * Server-only configuration.
 *
 * This file must never be imported from a client component. Keeping the secret
 * out of admin.config.ts is what stops it from reaching the browser bundle.
 */
export const serverConfig = defineAdminServerConfig({
  jwt: {
    secret: process.env.JWT_SECRET,
    algorithms: ['HS256'],
    cookieName: 'session',
  },
  apiBaseUrl: process.env.API_BASE_URL,
})
`

const MIDDLEWARE = `import { createAdminMiddleware } from '${PKG}/middleware'
import { adminConfig } from './admin.config'

/**
 * Redirects unauthenticated browsers to the login page.
 *
 * This is a UX guard, not an authorization boundary — Next middleware has been
 * bypassable before, and a token can be revoked after it was signed. The real
 * checks are the server-side guards on each page and route handler.
 */
export default createAdminMiddleware(adminConfig, {
  secret: process.env.JWT_SECRET,
  algorithms: ['HS256'],
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
`

function appTemplates(name: string): Template[] {
  return [
    { path: 'admin.config.ts', content: configTemplate(name, 'app') },
    { path: 'admin.server.ts', content: SERVER_CONFIG },
    { path: 'middleware.ts', content: MIDDLEWARE },
    {
      path: 'app/layout.tsx',
      content: `import type { ReactNode } from 'react'
import { AdminProvider } from '${PKG}/client'
import { serializeConfig } from '${PKG}'
import { adminConfig } from '@/admin.config'
import '${PKG}/styles.css'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* serializeConfig drops functions so the config can cross into a client component */}
        <AdminProvider config={serializeConfig(adminConfig)}>{children}</AdminProvider>
      </body>
    </html>
  )
}
`,
    },
    {
      path: 'app/dashboard/page.tsx',
      content: `import { AppShell, AppLauncher } from '${PKG}/ui'

export default function DashboardPage() {
  return (
    <AppShell>
      <AppLauncher />
    </AppShell>
  )
}
`,
    },
    {
      path: 'app/login/page.tsx',
      content: `import { LoginPage } from '${PKG}/ui'

export default function Page() {
  return <LoginPage />
}
`,
    },
    {
      path: 'app/admin/layout.tsx',
      content: `import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AdminShell } from '${PKG}/ui'
import { AccessDeniedError, getServerSession, requireAdmin, rolesFromSession } from '${PKG}/server'
import { adminConfig } from '@/admin.config'
import { serverConfig } from '@/admin.server'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers()
  const session = await getServerSession(adminConfig, { headers: requestHeaders }, { serverConfig })
  if (!session) redirect(adminConfig.auth.loginPage?.path ?? '/login')

  // Fails closed: administration decides who can access what, so a session we
  // cannot read must not open it.
  try {
    await requireAdmin(adminConfig, { roles: rolesFromSession(adminConfig, session) })
  } catch (error) {
    if (error instanceof AccessDeniedError) redirect(error.redirectTo ?? '/dashboard')
    throw error
  }

  return <AdminShell>{children}</AdminShell>
}
`,
    },
    {
      path: 'app/admin/users/page.tsx',
      content: `import { PageHeader, ResourceTable } from '${PKG}/ui'

export default function UsersPage() {
  return (
    <>
      <PageHeader title="Users" description="Accounts, roles and access." />
      {/* String template, not a callback — a function prop cannot be passed
          from a server component to a client one. */}
      <ResourceTable resource="users" hrefFor="/admin/users/:id" />
    </>
  )
}
`,
    },
    {
      path: 'app/api/auth/login/route.ts',
      content: `import { sessionCookie } from '${PKG}/server'

/**
 * Exchange credentials for a session cookie.
 *
 * Signing happens here (or against your upstream API) so the token is set as an
 * HttpOnly cookie and never reaches client JavaScript.
 */
export async function POST(request: Request) {
  const credentials = (await request.json()) as { email?: string; password?: string }

  // TODO: replace with a real call to your auth backend.
  const token = await signIn(credentials)
  if (!token) {
    return Response.json({ message: 'Invalid email or password' }, { status: 401 })
  }

  return Response.json(
    { ok: true },
    {
      headers: {
        'Set-Cookie': sessionCookie(token, {
          name: 'session',
          maxAge: 60 * 60 * 8,
          secure: process.env.NODE_ENV === 'production',
        }),
      },
    },
  )
}

async function signIn(_credentials: { email?: string; password?: string }): Promise<string | null> {
  throw new Error('Implement signIn() against your auth backend')
}
`,
    },
  ]
}

function pagesTemplates(name: string): Template[] {
  return [
    { path: 'admin.config.ts', content: configTemplate(name, 'pages') },
    { path: 'admin.server.ts', content: SERVER_CONFIG },
    { path: 'middleware.ts', content: MIDDLEWARE },
    {
      path: 'pages/_app.tsx',
      content: `import type { AppProps } from 'next/app'
import { AdminProvider } from '${PKG}/client'
import { adminConfig } from '@/admin.config'
import '${PKG}/styles.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AdminProvider config={adminConfig}>
      <Component {...pageProps} />
    </AdminProvider>
  )
}
`,
    },
    {
      path: 'pages/dashboard.tsx',
      content: `import { AppShell, AppLauncher } from '${PKG}/ui'

export default function DashboardPage() {
  return (
    <AppShell>
      <AppLauncher />
    </AppShell>
  )
}
`,
    },
    {
      path: 'pages/login.tsx',
      content: `import { LoginPage } from '${PKG}/ui'

export default function Page() {
  return <LoginPage />
}
`,
    },
  ]
}
