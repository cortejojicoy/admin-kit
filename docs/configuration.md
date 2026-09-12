# Configuration

Everything the kit does is driven by one object, `AdminConfig`, plus a small
server-only companion. This page is the reference for both.

## Two files, one boundary

```ts
// admin.config.ts
import { defineAdminConfig } from '@cortejojicoy/admin-kit'
export const adminConfig = defineAdminConfig({ /* … */ })
```

```ts
// admin.server.ts
import { defineAdminServerConfig } from '@cortejojicoy/admin-kit'
export const serverConfig = defineAdminServerConfig({
  jwt: { secret: process.env.JWT_SECRET, algorithms: ['HS256'] },
  apiBaseUrl: process.env.API_BASE_URL,
})
```

Both helpers are identity functions that exist for the type-checking. The split
is what matters: `admin.server.ts` must never be imported from a client
component, so the signing secret is not reachable from the module graph the
browser bundle builds.

## Why the config is serializable

`AdminConfig` is plain data on purpose:

- Icons are **string keys** resolved through a registry, never components.
- Visibility is **declarative** — `roles`, `permissions`, `accessCodes`,
  `requiredLevel` — never a predicate.
- Functions live in exactly three places: `resources[].map`, `auth.custom`, and
  `plugins`.

That constraint is what makes the rest work. Navigation can be resolved on the
server, where the user's permissions already are, and handed to a client shell
as data; and `admin-kit docs` can read the same file in plain Node.

```ts
import { serializeConfig, findUnserializable } from '@cortejojicoy/admin-kit'

serializeConfig(adminConfig)      // safe to pass into a client component
findUnserializable(adminConfig)   // paths to anything that would break — for a test
```

`serializeConfig()` strips the three function-bearing places plus any secret
that leaked into `auth.jwt`. The client re-attaches maps and plugins from its
own import of the same module, so nothing is lost — but nothing crosses the wire
that cannot.

`findUnserializable()` returns paths rather than throwing, so a test can report
all of them at once:

```ts
it('config can cross the RSC boundary', () => {
  expect(findUnserializable(serializeConfig(adminConfig))).toEqual([])
})
```

## Top-level keys

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `app` | `AppConfig` | required | Name, logo and tenant flavour |
| `router` | `'app' \| 'pages'` | `'app'` | Which router the adapters bind to |
| `auth` | `AuthConfig` | required | Provider, endpoints, login page |
| `navigation` | `{ sections }` | `{ sections: [] }` | Sidebar sections |
| `modules` | `ModuleDescriptor[]` | `[]` | Presentation overlay for the module catalog |
| `plugins` | `AdminPlugin[]` | — | Code-bearing feature packs; client-only |
| `resources` | `ResourceDescriptor[]` | `[]` | CRUD resources |
| `access` | `AccessConfig` | `{}` | The three axes, roles, hierarchy, deny |
| `panels` | `PanelsConfig` | see below | Launcher and sidebar panel settings |
| `theme` | `ThemeConfig` | `{ mode: 'system' }` | Mode, primary colour, tokens |
| `layout` | `LayoutConfig` | see below | Sidebar position, topbar, footer, width |
| `apiBaseUrl` | `string` | same origin | Prefixed onto every relative endpoint |

`resolveConfig()` fills every default exactly once, so no downstream code has to
guess. Both `<AdminProvider>` and the server helpers call it.

## `app`

```ts
app: {
  name: 'Axiomkit',
  logoIconKey: 'grid',        // key into the icon registry
  logoUrl: '/brand.svg',      // or an image, if the mark is one
  description: 'Here is your overview for today.',
  url: 'https://axiomkit.example',
  flavor: 'clinic',           // tenant flavour, see below
}
```

`flavor` picks between per-flavour wordings in module copy. One install of one
codebase can describe itself differently per customer:

```ts
{ code: 'BOOKINGS', title: 'Bookings',
  description: { default: 'Upcoming bookings.', clinic: 'Today’s appointments.' } }
```

A flavour with no entry of its own gets `default`, so adding a flavour later
inherits sensible wording instead of rendering blank.

## `panels`

Two panels, split by kind of work rather than kind of account. See
[Navigation & panels](./navigation.md).

```ts
panels: {
  app: {
    enabled: true,            // default true
    home: '/dashboard',       // default '/dashboard'
    title: 'Axiomkit',
    search: true,             // centred search slot in the topbar; default true
    greeting: true,           // greeting above the tiles; default true
    dockOrder: ['INBOX', 'TILL'],
  },
  admin: {
    enabled: true,            // default true
    basePath: '/admin',       // default '/admin'
    title: 'Axiomkit admin',
    sections: [/* NavSection[] */],
    backTo: '/dashboard',     // defaults to the app panel's home
    roles: ['admin'],         // defaults to access.adminRoles
  },
}
```

## `layout`

```ts
layout: {
  sidebarPosition: 'left',        // default 'left'
  sidebarCollapsible: true,       // default true
  sidebarDefaultCollapsed: false, // default false
  topbar: { visible: true },
  footer: { visible: true, text: '© Axiomkit' },
  maxWidth: '80rem',              // default '80rem'
}
```

## `theme`

```ts
theme: {
  mode: 'system',             // 'light' | 'dark' | 'system' — default 'system'
  primaryColor: '#1f6feb',
  tokens: { '--ak-radius': '0.75rem', '--ak-sidebar-width': '18rem' },
  className: 'axiomkit',
}
```

See [Theming](./theming.md) for the token list.

## `auth`

Covered in full in [Authentication](./authentication.md). The shape:

```ts
auth: {
  provider: 'jwt',            // 'jwt' | 'oauth' | 'custom'
  jwt: { /* JWTAuthConfig */ },
  oauth: { /* OAuthConfig */ },
  custom: myProvider,         // a live AuthProvider; client-side config only
  loginPage: { path: '/login', title: '…', subtitle: '…', logoIconKey: 'grid' },
  afterLoginRedirect: '/dashboard',   // defaults to panels.app.home
  afterLogoutRedirect: '/login',      // default '/login'
  publicRoutes: ['/login', '/api/auth'],
  meEndpoint: '/api/me',      // defaults to jwt.endpoints.me
  rolesField: 'roles',        // where roles live on the /me payload
}
```

`loginPage` is serializable only. Replacing the whole page is done by passing
`components={{ LoginPage }}` to `<AdminProvider>`, where components belong —
0.1.x allowed a `logo: ReactNode` and a `component: ComponentType` here, which
made the config impossible to hand from a server component to a client one.

## `access`

Covered in full in [Access control](./access-control.md).

```ts
access: {
  catalog:      { endpoint: '/api/modules', field: 'modules', fallback: STATIC_MODULES },
  entitlements: { endpoint: '/api/me/tenant', field: 'modules', onUnavailable: 'allow' },
  permissions:  { endpoint: '/api/me/permissions', field: 'permissions', onUnavailable: 'allow' },

  roles:     { admin: ['*'], editor: ['posts:*'] },
  hierarchy: { admin: ['editor'] },
  deny:      { editor: ['users:delete'] },
  adminRoles: ['admin'],
  defaultRequiredLevel: 'view',
}
```

Every axis is optional. With none configured the engine grants everything, which
is the right behaviour for a single-tenant app that has no permission backend
yet.

## `modules`

A module descriptor is the **presentation overlay** for one entry in the
backend's module catalog, keyed by `code`.

```ts
modules: [
  {
    code: 'BILLING',
    title: 'Billing',
    description: 'Invoices and payments.',
    href: '/admin/billing',
    iconKey: 'card',
    group: 'Finance',
    order: 20,
    accessCodes: ['BILLING', 'INVOICING'],   // either code grants it
    requiredLevel: 'view',
    placement: 'tile',                        // 'tile' | 'dock' | 'nav' | 'hidden'
    emphasis: 'primary',                      // 'primary' | 'critical'
    tone: 'violet',
    stats: [{ label: 'Open', value: '12' }],
    nav: [/* NavItem[] rendered once the user is inside the module */],
  },
]
```

The division of labour is deliberate: the backend owns which modules exist,
their title, their order and whether they are active; the frontend owns how they
look and where they sit. A catalog entry with no descriptor does not render, and
a descriptor with no catalog entry is dropped — so enabling a module server-side
makes it appear with no frontend deploy.

| `placement` | Meaning |
| --- | --- |
| `tile` | A card on the launcher home — for modules people run their shift from |
| `dock` | A cell in the quick-access bar — for stations people step into and back out of |
| `nav` | Reachable, but not advertised on the home view |
| `hidden` | Registered for access checks only |

## `navigation`

Sidebar sections for the admin panel and the classic single-shell layout.

```ts
navigation: {
  sections: [
    {
      id: 'people',
      label: 'People',
      order: 10,
      items: [
        { id: 'users', label: 'Users', href: '/admin/users', iconKey: 'users',
          permissions: ['users:list'], requiredLevel: 'view' },
        { label: 'Roles', href: '/admin/roles', roles: ['admin'], badge: 'new' },
      ],
    },
  ],
}
```

`NavItem` and `NavSection` are plain data for the same reason as everything
else: `iconKey` is a string, and visibility is declared rather than computed.
Anything genuinely dynamic belongs in a component, not in config. See
[Navigation & panels](./navigation.md).

## `plugins`

A plugin is a code-bearing feature pack: it can wrap the tree in a provider and
contribute widgets, nav sections and module descriptors.

```ts
const billing: AdminPlugin = {
  id: 'billing',
  navSections: [{ id: 'finance', label: 'Finance', items: [/* … */] }],
  modules: [{ code: 'BILLING', title: 'Billing', href: '/admin/billing' }],
  Provider: BillingProvider,                       // wraps children
  widgets: { 'dashboard.top': OutstandingInvoices },
  enabled: ({ roles, isAdmin }) => isAdmin || roles.includes('finance'),
}
```

Plugins hold components, so they are **not** serializable and must be registered
from a client module — pass them to `<AdminProvider plugins={[billing]}>`.
Keeping them separate from module descriptors is precisely what makes the rest
of the config able to cross the RSC boundary.

Render a plugin's widgets with `<WidgetSlot name="dashboard.top" />`.

## `resources`

Covered in full in [Resources & CRUD](./resources.md).

## Server config

```ts
interface AdminServerConfig {
  jwt?: {
    secret?: string           // HMAC secret for verifying session tokens
    algorithms?: string[]     // default ['HS256']
    cookieName?: string       // falls back to auth.jwt.cookieName
  }
  apiBaseUrl?: string         // absolute base URL for server-side fetches
}
```

`apiBaseUrl` matters more than it looks: a server-side fetch has no origin to be
relative to, so the access axes cannot be resolved from a relative path during
SSR unless this is set.

## Generating a record of your own config

```bash
npx admin-kit docs
```

`configuration.md` in the output lists every value you set and every default you
inherited, with secrets redacted — which is a better answer to "what is this
install actually doing" than reading the config file and remembering the
defaults. See [CLI](./cli.md).
