# Navigation & panels

There are two panels, and the split is by **kind of work**, not kind of account.

| Panel | For | Chrome | Route |
| --- | --- | --- | --- |
| App panel (launcher) | Daily work, for *every* account | Topbar, tile grid, quick-access dock | `panels.app.home`, default `/dashboard` |
| Admin panel | Configuration work | Sidebar, topbar | `panels.admin.basePath`, default `/admin` |

The reference implementation this kit came from flipped the entire chrome on an
`isAdmin` flag. Administrators therefore never saw the launcher, everyone else
never saw a sidebar, and "the admin layout" was just the app with different
navigation. Splitting by work instead means an administrator uses the same
launcher as everyone else and steps into the admin panel when they are
administering.

## The app panel

```tsx
// app/dashboard/page.tsx
import { AppShell, AppLauncher } from '@cortejojicoy/admin-kit/ui'

export default function Page() {
  return (
    <AppShell>
      <AppLauncher />
    </AppShell>
  )
}
```

`<AppShell>` takes `topbar`, `search`, `actions` and `footer` slots; everything
it needs — config, router, access — comes from context. `<AppLauncher>` takes
`header`, `primaryAction` and `empty`.

```ts
panels: {
  app: {
    home: '/dashboard',
    title: 'Axiomkit',
    search: true,                    // centred search slot in the topbar
    greeting: true,                  // greeting block above the tiles
    dockOrder: ['INBOX', 'TILL'],    // pinned dock modules, in this order
  },
}
```

### Tiles and the dock

Both come from the same module descriptors and the same access engine, so what a
user sees is exactly what their permissions allow — nothing needs a second
opinion.

| `placement` | Where it appears | What it is for |
| --- | --- | --- |
| `tile` | A card on the launcher home | Modules people *run their shift from* — the thing they open and stay in |
| `dock` | A cell in the quick-access bar | *Stations* people step into and back out of: check a reading, take a payment |
| `nav` | Reachable, not advertised on the home view | Secondary destinations |
| `hidden` | Nowhere | Registered for access checks only |

The tile/dock distinction is the one worth getting right. Given cards of equal
weight, stations dilute the grid into a set of equally-likely choices — which is
precisely the failure this split exists to avoid.

### Emphasis

```ts
{ code: 'USERS', title: 'People', href: '/admin/users', placement: 'tile', emphasis: 'primary' }
```

`primary` takes the wide cell and `critical` the highlighted one beside it. When
the user holds neither, the shell falls back to an even grid — so the layout
degrades by permission rather than leaving a hole where a tile was.

## The admin panel

```tsx
// app/admin/layout.tsx
import { AdminShell } from '@cortejojicoy/admin-kit/ui'

export default async function AdminLayout({ children }) {
  // …requireAdmin() here — see Access control
  return <AdminShell>{children}</AdminShell>
}
```

A permanent rail on wide screens, a slide-in drawer with an overlay below the
breakpoint, and a collapsed state that persists. Mounting it is
`<AdminShell>{children}</AdminShell>` and nothing else — 0.1.x required
`config`, `Link` and `currentPath` to be threaded in by hand.

Replace the sidebar entirely with `sidebar={…}`, or fill the topbar slots with
`topbar={{ title, actions, children }}`.

The admin topbar deliberately has no search slot: search in this kit looks up
records within a resource, which is the table's job, not the chrome's.

### Sections

```ts
panels: {
  admin: {
    basePath: '/admin',
    title: 'Axiomkit admin',
    backTo: '/dashboard',
    roles: ['admin'],
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
  },
}
```

Sidebar sections are static by design: the panel is admin-gated as a whole, so
there is no per-item entitlement story to tell inside it.

`config.navigation.sections` holds the same shape for the classic single-shell
layout.

## Nav items are data

```ts
interface NavItem {
  id?: string                  // stable id; used to merge plugin items into config sections
  label: string
  href?: string
  iconKey?: string             // a key into the icon registry, not a component
  badge?: string | number
  external?: boolean
  hidden?: boolean             // hard hide, for feature flags
  roles?: string[]             // visible to holders of any of these roles
  permissions?: string[]       // visible to holders of any of these codes
  accessCodes?: string[]       // alternative codes that also grant this item
  requiredLevel?: AccessLevel  // minimum level over permissions/accessCodes; default 'view'
  children?: NavItem[]         // nested items render as a collapsible group
  order?: number               // sort weight, ascending; default 0
}
```

0.1.x typed `icon` as a `ReactNode` and `visible` as a predicate, which made any
config carrying either one impossible to pass from a server component into a
client one. That blocked the entire pattern this kit is built around: resolve
navigation on the server, where the user's permissions already are, and hand the
finished tree to a client shell.

So icons are string keys and visibility is declarative. Anything genuinely
dynamic belongs in a component, not in config.

## Building and filtering the tree

```ts
import { buildNav, filterNav, modulesToSections } from '@cortejojicoy/admin-kit'
import { createAccessEngine } from '@cortejojicoy/admin-kit'

const nav = buildNav(config)                       // config sections + plugin sections, merged
const visible = filterNav(nav, createAccessEngine(snapshot, config.access))
```

The same engine filters nav, decides which tiles render, answers `<Can>` and
backs the server guards — so those four can never disagree.

**Filtering is not a gate.** A hidden link is still a reachable URL. See
[Access control](./access-control.md).

## Modules

```ts
import { buildModules, tileModules, dockModules } from '@cortejojicoy/admin-kit'

const modules = buildModules(catalog, config.modules, { flavor: config.app.flavor })
tileModules(modules)
dockModules(modules, config.panels?.app?.dockOrder)
```

A catalog entry with no descriptor does not render, and a descriptor with no
catalog entry is dropped. Enabling a module server-side therefore makes it
appear with no frontend deploy, while presentation stays where presentation
belongs.

## Icons

Icons are resolved through a registry, so a string key in config becomes a
component at render time.

```tsx
// lib/icons.tsx
'use client'
import type { IconRegistry } from '@cortejojicoy/admin-kit/client'
import { Building } from 'lucide-react'

export const icons: IconRegistry = { building: Building }
```

```tsx
<AdminProvider config={adminConfig} icons={icons}>
```

Built-in keys: `dashboard`, `users`, `user`, `settings`, `shield`, `key`,
`list`, `table`, `plus`, `edit`, `trash`, `search`, `bell`, `home`,
`chevronLeft`, `chevronRight`, `chevronDown`, `menu`, `logout`, `grid`,
`activity`, `alert`, `check`, `close`, `database`, `document`, and `fallback`.
An unknown key renders `fallback` rather than throwing — a typo in config should
not blank a page.

Render one directly with `<Icon name="users" />`.

## Router adapters

The shells get routing through context, so the same components work on both
routers:

```tsx
import { appRouterAdapter } from '@cortejojicoy/admin-kit/client'   // App Router
import { pagesRouterAdapter } from '@cortejojicoy/admin-kit/client' // Pages Router

<AdminProvider config={adminConfig} router={appRouterAdapter}>
```

`config.router` (`'app'` or `'pages'`) tells the rest of the kit which flavour
to assume — the CLI scaffolds for it, and the docs generator names it.

## Documenting your navigation

`npx admin-kit docs` writes a `navigation.md` listing your tiles, dock and
sidebar, each annotated with what it requires to be visible.
