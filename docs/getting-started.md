# Getting started

`@cortejojicoy/admin-kit` is a Next.js admin toolkit you configure rather than
fork. You declare your endpoints, your permissions and your modules once; you
get a launcher panel, a sidebar panel, generated CRUD screens, and documentation
of your own installation.

This page takes you from an empty Next.js app to a working install. It assumes
Next 15 or 16, React 19, and Node 20.9 or newer.

## Install

```bash
pnpm add @cortejojicoy/admin-kit
# npm install @cortejojicoy/admin-kit
```

`next`, `react` and `react-dom` are peer dependencies — the kit uses the copies
your app already has. `jiti` is an optional peer, needed only so the CLI can
read a TypeScript config file.

## Scaffold

```bash
npx admin-kit init
```

That writes both config files, the middleware, the login route and one page per
panel. It refuses to overwrite anything unless you pass `--force`, so it is safe
to run inside an existing project. Pass `--router pages` if you are on the Pages
Router, and `--name "Axiomkit"` to seed the app name.

The rest of this page explains what it wrote, in the order the pieces matter.

## 1. Configure

Configuration lives in two files, and the split is the point.

```ts
// admin.config.ts — plain data, imported by both server and client
import { defineAdminConfig } from '@cortejojicoy/admin-kit'

export const adminConfig = defineAdminConfig({
  app: { name: 'Axiomkit', logoIconKey: 'grid' },

  auth: {
    provider: 'jwt',
    jwt: {
      endpoints: { login: '/api/auth/login', me: '/api/auth/me', logout: '/api/auth/logout' },
      tokenStorage: 'server-cookie',   // HttpOnly; the browser never holds the token
      cookieName: 'axiomkit_session',
    },
    loginPage: { path: '/login' },
  },

  access: {
    roles: { admin: ['*'], manager: ['users:*'], staff: ['users:list'] },
    hierarchy: { admin: ['manager'] },
    deny: { manager: ['users:delete'] },
  },

  modules: [
    { code: 'USERS', title: 'People', href: '/admin/users', iconKey: 'users',
      placement: 'tile', emphasis: 'primary' },
    { code: 'INBOX', title: 'Inbox', href: '/inbox', iconKey: 'bell',
      placement: 'dock' },
  ],

  resources: [
    {
      name: 'users',
      endpoints: {
        list:   '/api/users',
        one:    '/api/users/:id',
        create: { method: 'POST',   path: '/api/users' },
        update: { method: 'PATCH',  path: '/api/users/:id' },
        remove: { method: 'DELETE', path: '/api/users/:id' },
      },
      query: { page: 'page', perPage: 'per_page', search: 'q' },
      fields: [
        { name: 'name', required: true, sortable: true },
        { name: 'email', type: 'email', required: true },
        { name: 'active', type: 'boolean' },
      ],
      permissions: { list: 'users:list', create: 'users:create', remove: 'users:delete' },
    },
  ],
})
```

```ts
// admin.server.ts — never imported from a client component
import { defineAdminServerConfig } from '@cortejojicoy/admin-kit'

export const serverConfig = defineAdminServerConfig({
  jwt: { secret: process.env.JWT_SECRET, algorithms: ['HS256'] },
})
```

The secret lives in the second file so it is not reachable from the module graph
the browser bundle imports. In 0.1.x it sat on `config.auth.jwt.secret`, which
survived only because Next strips non-`NEXT_PUBLIC_` environment variables from
client bundles — one hardcoded string away from shipping the signing key to the
browser.

See [Configuration](./configuration.md) for every key, and
[Authentication](./authentication.md) for the provider options.

## 2. Mount the provider

Resolve the session and the access snapshot on the server, then hand them down
as data. Components — icons, plugins, overrides — cannot cross that boundary, so
they are registered in a small client file.

```tsx
// app/providers.tsx
'use client'
import { AdminProvider } from '@cortejojicoy/admin-kit/client'
import { adminConfig } from '@/admin.config'
import { icons } from '@/lib/icons'

export function Providers({ session, snapshot, children }) {
  return (
    <AdminProvider config={adminConfig} initialSession={session} snapshot={snapshot} icons={icons}>
      {children}
    </AdminProvider>
  )
}
```

```tsx
// app/layout.tsx
import { headers } from 'next/headers'
import { getServerSession, resolveAccess, rolesFromSession } from '@cortejojicoy/admin-kit/server'
import { adminConfig } from '@/admin.config'
import { serverConfig } from '@/admin.server'
import { Providers } from './providers'
import '@cortejojicoy/admin-kit/styles.css'

export default async function RootLayout({ children }) {
  const session = await getServerSession(adminConfig, { headers: await headers() }, { serverConfig })
  const roles = rolesFromSession(adminConfig, session)
  const snapshot = await resolveAccess(adminConfig, { roles })

  return (
    <html lang="en">
      <body>
        <Providers session={session} snapshot={snapshot}>{children}</Providers>
      </body>
    </html>
  )
}
```

Because the snapshot is resolved server-side, the first paint already shows the
right navigation for the right user — no client fetch, and no flash of items
they cannot see.

## 3. The panels

There are two, and they are split by kind of work rather than kind of account.

```tsx
// app/dashboard/page.tsx — the launcher, where everyone lands
import { AppShell, AppLauncher } from '@cortejojicoy/admin-kit/ui'

export default function Page() {
  return <AppShell><AppLauncher /></AppShell>
}
```

```tsx
// app/admin/layout.tsx — the sidebar panel, gated once for everything beneath it
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { AdminShell } from '@cortejojicoy/admin-kit/ui'
import {
  AccessDeniedError,
  getServerSession,
  requireAdmin,
  rolesFromSession,
} from '@cortejojicoy/admin-kit/server'

export default async function AdminLayout({ children }) {
  const session = await getServerSession(adminConfig, { headers: await headers() }, { serverConfig })
  if (!session) redirect('/login')

  try {
    await requireAdmin(adminConfig, { roles: rolesFromSession(adminConfig, session) })
  } catch (error) {
    if (error instanceof AccessDeniedError) redirect(error.redirectTo ?? '/dashboard')
    throw error
  }

  return <AdminShell>{children}</AdminShell>
}
```

[Navigation & panels](./navigation.md) covers what goes in each one.

## 4. A CRUD screen

```tsx
import { PageHeader, ResourceTable } from '@cortejojicoy/admin-kit/ui'

export default function UsersPage() {
  return (
    <>
      <PageHeader title="People" />
      <ResourceTable resource="users" hrefFor="/admin/users/:id" />
    </>
  )
}
```

Columns, endpoint, page size, sorting, search, pagination and the delete
button's permission all come from the resource definition. `<ResourceForm>` and
`<ResourceShow>` work the same way. When the generated screens stop fitting,
drop to the hooks — `useList`, `useOne`, `useCreate`, `useUpdate`, `useDelete`,
`useAction` — and keep everything else. See [Resources & CRUD](./resources.md).

## 5. Protect the routes

```ts
// middleware.ts
import { createAdminMiddleware } from '@cortejojicoy/admin-kit/middleware'
import { adminConfig } from './admin.config'

export default createAdminMiddleware(adminConfig, { secret: process.env.JWT_SECRET })
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'] }
```

**This is not the authorization boundary.** Middleware sends a signed-out
browser to the login page instead of rendering a shell that will fail every
request it makes. The real checks go in route handlers and server components:
`getServerSession()` then `assertPermission()`. [Access
control](./access-control.md) explains which layer does what, and why the
difference matters.

## 6. Generate docs for your install

```bash
npx admin-kit docs
```

This reads your config in plain Node and writes markdown describing *your*
endpoints, *your* roles and *your* screens — not a template. Wire
`admin-kit docs --check` into CI and the docs cannot drift from the config.
See [CLI](./cli.md).

## Where to go next

| If you want to… | Read |
| --- | --- |
| Understand every config key | [Configuration](./configuration.md) |
| Change how sign-in works | [Authentication](./authentication.md) |
| Get authorization right | [Access control](./access-control.md) |
| Shape the launcher and sidebar | [Navigation & panels](./navigation.md) |
| Add another CRUD screen | [Resources & CRUD](./resources.md) |
| Restyle it | [Theming](./theming.md) |
| See a finished install | [`examples/app-router`](../examples/app-router) |

The example app is a complete installation: HttpOnly cookie auth, three roles
with inheritance and a deny rule, both panels, a generated CRUD screen, and
route handlers that actually refuse unauthorized requests. It is built in CI,
which is what catches the class of bug that typechecks cleanly and ships broken.

```bash
pnpm install
pnpm --filter @examples/app-router dev
# sign in with any seeded email and the password "demo"
```
