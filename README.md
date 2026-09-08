# @cortejojicoy/admin-kit

A Next.js admin toolkit you configure rather than fork. Declare your endpoints,
your permissions and your modules once; get a launcher panel, a sidebar panel,
generated CRUD screens, and documentation of your own installation.

```bash
pnpm add @cortejojicoy/admin-kit
npx admin-kit init        # scaffold config, middleware, panels and routes
npx admin-kit docs        # generate docs for *your* config
```

- **Every endpoint is yours.** Login was pluggable in 0.1.x; now list, read,
  create, update, delete and any named action are too — declared per resource,
  with the wire format mapped in both directions.
- **Three-axis access control.** Catalog (does the module exist?), entitlement
  (may this tenant run it?), permission (may this user open it?) — separately
  configured, with `none` / `view` / `full` levels rather than a boolean.
- **Two panels.** A launcher for daily work that *everyone* lands on, and a
  sidebar panel for administration. Split by kind of work, not kind of account.
- **Serializable config.** Plain data, so it can be resolved on the server with
  the user's permissions in hand and read by a CLI in plain Node.
- **Styled on install.** One stylesheet driven by CSS custom properties. No
  Tailwind, no preset, no content globs.
- App Router and Pages Router; React 19; Next 15 and 16.

## Quick start

### 1. Configure

```ts
// admin.config.ts — plain data, imported by both server and client
import { defineAdminConfig } from '@cortejojicoy/admin-kit'

export const adminConfig = defineAdminConfig({
  app: { name: 'Northwind', logoIconKey: 'grid' },

  auth: {
    provider: 'jwt',
    jwt: {
      endpoints: { login: '/api/auth/login', me: '/api/auth/me', logout: '/api/auth/logout' },
      tokenStorage: 'server-cookie',   // HttpOnly; the browser never holds the token
      cookieName: 'northwind_session',
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

The split is the point: the secret is not reachable from the module graph the
browser bundle imports.

### 2. Mount the provider

Resolve the session and access on the server, then hand them down as data.
Components — icons, plugins, overrides — cannot cross that boundary, so they are
registered in a small client file.

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
right navigation for the right user — no client fetch, no flash of items they
cannot see.

### 3. The panels

```tsx
// app/dashboard/page.tsx — the launcher, where everyone lands
import { AppShell, AppLauncher } from '@cortejojicoy/admin-kit/ui'

export default function Page() {
  return <AppShell><AppLauncher /></AppShell>
}
```

```tsx
// app/admin/layout.tsx — the sidebar panel, gated once for everything beneath it
import { AdminShell } from '@cortejojicoy/admin-kit/ui'
import { AccessDeniedError, getServerSession, requireAdmin, rolesFromSession } from '@cortejojicoy/admin-kit/server'

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

### 4. A CRUD screen

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

Columns, endpoint, page size, sorting, search, pagination and the delete button's
permission all come from the resource definition. `<ResourceForm>` and
`<ResourceShow>` work the same way. When the generated screens stop fitting, drop
to the hooks (`useList`, `useOne`, `useCreate`, `useUpdate`, `useDelete`,
`useAction`) and keep everything else.

### 5. Protect the routes

```ts
// middleware.ts
import { createAdminMiddleware } from '@cortejojicoy/admin-kit/middleware'
import { adminConfig } from './admin.config'

export default createAdminMiddleware(adminConfig, { secret: process.env.JWT_SECRET })
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'] }
```

## Authorization: what actually gates what

Three layers, and only one of them is a gate:

| Layer | Job | Not its job |
| --- | --- | --- |
| `createAdminMiddleware` | Redirect a signed-out browser to the login page | Authorization. Next middleware has been bypassable (CVE-2025-29927), and a token can be revoked after it was signed |
| `<Can>`, `<RequirePermission>` | Hide controls the user cannot use | Authorization. A hidden button is still a reachable endpoint |
| `requireModule`, `requireAdmin`, `assertPermission` | **Refuse the request** | — |

```ts
// app/api/users/route.ts
import { assertPermission, AccessDeniedError } from '@cortejojicoy/admin-kit/server'

export async function POST(request: Request) {
  const { session, roles } = await currentSession()
  if (!session) return Response.json({ message: 'Not signed in' }, { status: 401 })
  try {
    await assertPermission(adminConfig, 'users:create', { roles })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return Response.json({ message: error.message }, { status: 403 })
    }
    throw error
  }
  // …
}
```

## The three access axes

```ts
access: {
  catalog:      { endpoint: '/api/modules', fallback: STATIC_MODULES },
  entitlements: { endpoint: '/api/me/tenant', field: 'modules', onUnavailable: 'allow' },
  permissions:  { endpoint: '/api/me/permissions', onUnavailable: 'allow' },
  roles:     { admin: ['*'], editor: ['posts:*'] },
  hierarchy: { admin: ['editor'] },
  deny:      { editor: ['users:delete'] },
}
```

| Axis | Question | If the source cannot be read |
| --- | --- | --- |
| Catalog | Does the module exist and is it active? | Fall back to the declared modules, so navigation never blanks |
| Entitlement | May this tenant run it? | Fail **open** by default |
| Permission | May this user open it? | Fail **open** by default |

Failing open is deliberate: a control-plane read that failed must not lock a
paying customer out of software they have paid for. Set `onUnavailable: 'deny'`
per axis where absence genuinely means no. Anything guarding administration
itself (`requireAdmin`) fails closed regardless.

Levels are ordered `none` < `view` < `full`, so read-only access is expressible.
Permission patterns support wildcards (`users:*`, `*:list`, `*`); `deny` beats
every grant; role hierarchy accumulates grants but **not** restrictions — a
denial on `manager` does not bind an `admin` who merely inherits it.

## Serializable configuration

`AdminConfig` is plain data on purpose. Icons are string keys resolved through a
registry, visibility is declarative (`roles`, `permissions`, `accessCodes`,
`requiredLevel`), and functions live only in `resources[].map`, `auth.custom` and
plugins — the three places `serializeConfig()` strips at the boundary.

That constraint is what makes the rest work: navigation can be resolved on the
server, and `admin-kit docs` can read your config in plain Node.

```ts
import { serializeConfig, findUnserializable } from '@cortejojicoy/admin-kit'

serializeConfig(adminConfig)      // safe to pass into a client component
findUnserializable(adminConfig)   // paths to anything that would break — for a test
```

## Documentation generator

```bash
admin-kit docs                 # write docs/admin/**.md from your config
admin-kit docs --check         # CI: fail if they are out of date
admin-kit docs --out … --format md|mdx --config …
```

| File | Content |
| --- | --- |
| `getting-started.md` | Copy-paste snippets using your paths, your names |
| `auth.md` | Your endpoint table, session storage and its exposure, env vars |
| `access.md` | The three gates as configured, plus a role → permission matrix |
| `navigation.md` | Tiles, dock and sidebar, annotated with what each requires |
| `resources.md` | Per resource: endpoints, verbs, permissions, fields, snippets |
| `configuration.md` | Every value set and every default inherited, secrets redacted |

Generated from your config, not from a template — so it describes your
installation, and `--check` in CI stops it from drifting. See
[`examples/app-router/docs`](examples/app-router/docs) for real output.

## Theming

One stylesheet, driven entirely by custom properties:

```ts
theme: {
  mode: 'system',
  primaryColor: '#1f6feb',
  tokens: { '--ak-radius': '0.75rem', '--ak-sidebar-width': '18rem' },
}
```

Every component takes `className`, so a design system can restyle rather than
reimplement. Skip the stylesheet import entirely if you would rather style it
yourself.

## Sub-path exports

| Sub-path | Contents | Environment |
| --- | --- | --- |
| `@cortejojicoy/admin-kit` | Config helpers, types, pure logic | Anywhere, including plain Node |
| `…/client` | `AdminProvider`, contexts, hooks | Client |
| `…/data` | CRUD hooks, data provider, resource types | Client |
| `…/access` | Engine, `<Can>`, guards | Client |
| `…/ui` | Panels, primitives, generated screens | Client |
| `…/server` | Session, access gates, cookies | Server |
| `…/middleware` | `createAdminMiddleware` | Edge |
| `…/styles.css` | The stylesheet | — |

## Example

[`examples/app-router`](examples/app-router) is a complete installation: HttpOnly
cookie auth, three roles with inheritance and a deny rule, both panels, a
generated CRUD screen, and route handlers that actually refuse unauthorized
requests. It is built in CI, which is what catches the class of bug that
typechecks cleanly and ships broken.

```bash
pnpm install
pnpm --filter @examples/app-router dev
# sign in with any seeded email and the password "demo"
```

## Development

```bash
pnpm verify      # typecheck + lint + test + build + smoke + publint + attw
pnpm test        # vitest
pnpm build       # tsup + stylesheet copy
```

`pnpm verify` is the publish gate. It loads every entry point in both module
systems, asserts the `"use client"` directives land where they belong, tests the
release tooling, and runs `publint` and `are-the-types-wrong` against the packed
tarball. `tool/release.sh` runs it before it will tag anything.

## Versioning and releases

Git tags are the source of truth. `package.json`'s `version` is a derived
artifact, written from the tag at release time — so a published version always
has a tag pointing at the exact commit it was built from.

`tool/version.py` owns the scheme (adapted from the same tool in
`trackbnb-flutter`):

```
vMAJOR.MINOR.PATCH[-stage.N]        alpha | beta | rc | lts
```

### Cutting a release

From a clean `main`:

```bash
./tool/release.sh minor              # 0.1.8 → v0.2.0
./tool/release.sh beta               # open a public-testing cycle
./tool/release.sh promote            # turn the current pre-release stable
./tool/release.sh patch --dry-run    # show everything, change nothing
```

It refuses to run from a dirty tree, a branch other than `main`, or a `main`
behind origin. Then it runs `pnpm verify`, promotes the CHANGELOG's
`## [Unreleased]` section, writes the version into `package.json`, commits, tags
that commit, and pushes. CI publishes from the tag.

### The stage progression

| Tag | Meaning | Next step |
| --- | --- | --- |
| `v0.1.0` | seed | `patch` |
| `v0.1.1` | bug fix in development | `patch` |
| `v0.1.2-alpha.1` | enter internal testing | `alpha` |
| `v0.1.2-alpha.2` | another internal build | `alpha` |
| `v0.1.2` | stable at alpha, released | `promote` |
| `v0.1.3` | minor bug fix | `patch` |
| `v0.2.0-beta.1` | enter public testing | `beta` |
| `v0.2.1` | stable at beta | `promote` |
| `v0.3.0-rc.1` | final validation | `rc` |
| `v0.3.1` | final release | `promote` |
| `v1.0.0-lts.1` | production candidate | `lts` |
| `v1.0.0` | official release | `promote` |

Ordering is semver — a pre-release sorts before its bare version — with one
deliberate exception: stages rank `alpha < beta < rc < lts`, where strict semver
would compare the identifiers lexically and put `lts` before `rc`.

### npm channels

A pre-release publishes under its own dist-tag, so `npm install` keeps serving
the stable release and opting in is explicit:

```bash
npm install @cortejojicoy/admin-kit         # latest stable
npm install @cortejojicoy/admin-kit@beta    # current beta
```

### Inspecting

```bash
./tool/version.py current         # newest tag
./tool/version.py stage           # alpha | beta | rc | lts | stable | none
./tool/version.py list            # every release tag, oldest first
./tool/version.py next beta       # what `release.sh beta` would create
./tool/version.py notes           # release notes for the current tag
./tool/version.py check           # tag, package.json and HEAD all agree?
```

`next` computes from the higher of the newest tag and `package.json`, so a
version already on the registry can never be proposed again. That case is real
here: `v0.1.8` was published without its tag ever being pushed, so the newest
tag reads `v0.1.7` while npm reads `0.1.8`.

### CI

[.github/workflows/ci.yml](.github/workflows/ci.yml):

| Trigger | What happens |
| --- | --- |
| Push to `main` | `verify` only |
| Pull request | `verify` only |
| Push of a `v*.*.*` tag | `verify`, then publish with provenance and a GitHub release |

Publishing uses npm trusted publishing (OIDC — no `NPM_TOKEN`). There is
deliberately **no** auto-bump-on-push job: it cannot coexist with tag-driven
versioning, since a job that bumps `package.json` on every commit immediately
disagrees with the tool that computes versions from tags.

## License

MIT
