# admin-kit — Plan

Scope: turn `@cortejojicoy/admin-kit` (v0.1.8, ~2.2k LOC) from "pluggable auth + sidebar"
into a config-driven admin toolkit with (1) fully pluggable CRUD endpoints, (2) a default
roles/permissions module, (3) two default panels — a launcher app panel and a sidebar admin panel, and
(4) a markdown docs generator.

The launcher/admin model, the permission plumbing, and the module registry are generalized
from `hms-saas/fe-next`, which already implements all three — see §7 for the mapping.

---

## 0. Review of what exists today

**Solid foundations, keep them:**

- `AuthProvider` strategy interface (`login/logout/getSession/refresh`) with jwt/oauth/custom
  factories — this is exactly the right seam to generalize to CRUD.
- `AdminConfig` + `defineAdminConfig` + `resolveConfig` defaults layering.
- Subpath exports (`.` / `client` / `server` / `middleware`) with the isomorphic core kept
  React-free — this is what makes a Node-side docs CLI possible later.
- `buildNav` (id-merge + stable order sort) and `filterNav` (recursive, prunes empty groups).
- Edge `verifyJWT` on Web Crypto — HMAC only, but it does check `exp` and `nbf`.
- Release/CI story (trusted publishing, provenance, changelog automation) is more mature than
  the library itself.

### P0 — the published tarball is broken in three ways

1. **`exports` map does not match build output.** `tsup` with `type: "module"` emits
   `dist/index.js` (ESM) + `dist/index.cjs` (CJS). `package.json` points `import` at
   `./dist/index.mjs` — *which does not exist* — and `require` at `./dist/index.js`, which is
   ESM. Every entry (`.`, `/client`, `/server`, `/middleware`) has this. Verified: `ls dist/`
   has no `.mjs` file. So `import { defineAdminConfig } from '@cortejojicoy/admin-kit'`
   fails with `ERR_MODULE_NOT_FOUND` on a clean install.
2. **`"use client"` is stripped from the bundle.** `tsup.config.ts` claims esbuild preserves
   the directive; it does not when bundling. `grep -c 'use client' dist/client.js` → `0`.
   Any App Router consumer importing `/client` gets the "importing a component that needs
   useState" build error.
3. **`createAdminMiddleware` cannot pass a request through.** `passthrough()` returns
   `new Response(null, { status: 200 })` with the source comment admitting it is guesswork.
   In Next middleware that replaces the page with an empty 200 body — every authenticated
   route renders blank. It must be `NextResponse.next()`.

None of these can be caught by `tsc --noEmit`, which is why they shipped. The fix is an
`examples/` app in CI, plus `publint` + `@arethetypeswrong/cli` as a publish gate.

### P1 — security and correctness

4. **`auth.jwt.secret` lives on the config object that client components import.** Today it
   survives only because Next strips non-`NEXT_PUBLIC_` env vars on the client; one
   hardcoded string or `NEXT_PUBLIC_` prefix leaks the signing key into the JS bundle. The
   secret must not be reachable from the client config graph — split it out.
5. **Default JWT storage is a JS-written, non-`HttpOnly`, non-`Secure` cookie.**
   `JWTProvider.writeToken` does `document.cookie = ...; SameSite=Lax` — readable by any XSS.
   Default should be a server-set `HttpOnly; Secure` cookie from the login route.
6. **Middleware treats mere cookie *presence* as authenticated for oauth/custom** (no
   verifier configured). Combined with Next's history here (CVE-2025-29927), middleware must
   be documented as a UX redirect only, never the authorization boundary. Real checks belong
   in route handlers / server components via `getServerSession` + `assertPermission`.
7. **`verifyJWT` needs an expected-algorithm allowlist.** It reads `alg` from the untrusted
   header and looks it up in `ALGS`. Non-HMAC and `none` are rejected today by omission,
   but an explicit `algorithms: ['HS256']` option closes alg-confusion by construction.
8. **`ModuleRegistry.widgets` resolves to `never`.** `AdminModule['widgets']` is
   `Record<string, ComponentType> | undefined`, so `extends Record<string, infer V>` fails
   and `Component` is typed `never` — unusable by consumers.
9. **`AdminConfig` is not RSC-serializable, so it cannot be defined once and shared.**
   `NavItem.icon` is a `ReactNode`, `NavItem.visible` / `NavSection.visible` are functions,
   `LoginPageConfig.logo` is a `ReactNode`, `LoginPageConfig.component` is a `ComponentType`,
   and `auth.custom` is a live object with methods. A config carrying any of these cannot
   cross a server→client boundary, which blocks the whole pattern of resolving nav on the
   server (with the user's permissions) and handing it to a client shell. `hms-saas/fe-next`
   hit this and solved it with **serializable string icon keys** resolved to components by
   each renderer (`ModuleIconKey`, `lib/modules/registry.ts:47`). admin-kit needs the same
   split: a serializable config/descriptor layer, plus a client-side component registry
   keyed by string. This is the most consequential design change in the plan.
10. **`creds` in the repo root is untracked *and* not gitignored.** One `git add -A` from
   being committed. Add to `.gitignore` and rotate whatever it holds.

### P2 — API ergonomics and delivery

11. **Styling silently does nothing.** Components emit Tailwind utilities
    (`min-h-screen bg-neutral-50`), no CSS ships in `dist/`, and nothing documents that the
    consumer needs Tailwind *plus* a content glob over `node_modules/@cortejojicoy/admin-kit`.
    Meanwhile `theme/tokens.ts` defines a full CSS-variable token set that the components
    never use. Two parallel styling systems, neither wired up. (Decision D2.)
12. **Layout boilerplate.** `AdminLayout` demands `config` (separately `resolveConfig`'d),
    `Link`, and `currentPath` props; the README shows `resolveConfig` called twice. Config,
    router adapter, and pathname should come from context.
13. **No tests, no eslint config** (the `lint` script invokes a config that doesn't exist),
    and **no `examples/`** — while CI auto-publishes on *every* push to `main`.

---

## 1. Target architecture

Layered so each feature is opt-in and the core stays Node-loadable:

```
@cortejojicoy/admin-kit             core — config, types, define* helpers   (no React, no DOM)
@cortejojicoy/admin-kit/client      providers, hooks, context
@cortejojicoy/admin-kit/data        resources, data providers, CRUD hooks
@cortejojicoy/admin-kit/rbac        policy engine, <Can>, guards
@cortejojicoy/admin-kit/ui          shells (Admin + App), components, styles.css
@cortejojicoy/admin-kit/server      getServerSession, verifyJWT, assertPermission
@cortejojicoy/admin-kit/middleware  edge middleware
@cortejojicoy/admin-kit/cli         bin: admin-kit init | docs
```

`/client` stays a compat barrel re-exporting the new subpaths so 0.1.x imports keep working.

Cross-cutting change that everything else depends on: **`AdminConfigContext`**. `AdminProvider`
resolves the config once, picks the router adapter from `config.router`, and exposes
`useAdminConfig()` / `useRouterAdapter()`. Shells and guards then need no props.

---

## 2. Milestone A — pluggable CRUD (`/data`)

Generalize the auth-endpoint idea to every operation. Three layers:

**Resource definition** — declarative, per entity:

```ts
export const users = defineResource({
  name: 'users',
  endpoints: {
    list:   { method: 'GET',    path: '/api/users' },
    one:    { method: 'GET',    path: '/api/users/:id' },
    create: { method: 'POST',   path: '/api/users' },
    update: { method: 'PATCH',  path: '/api/users/:id' },
    remove: { method: 'DELETE', path: '/api/users/:id' },
    // arbitrary extras: invoked via useAction('users','impersonate')
    impersonate: { method: 'POST', path: '/api/users/:id/impersonate' },
  },
  // wire format in both directions — every backend shape is someone's convention
  map: {
    list:   (raw) => ({ rows: raw.data, total: raw.meta.total }),
    one:    (raw) => raw.data,
    toWire: (input) => input,
    error:  (raw, status) => ({ message: raw.detail, fields: raw.errors, status }),
  },
  query: { page: 'page', perPage: 'per_page', sort: 'sort', order: 'order', search: 'q' },
  permissions: { list: 'users:list', create: 'users:create', update: 'users:update' },
  fields: [ /* drives the generic table/form UI */ ],
})
```

**Data provider** — the transport strategy, mirroring `AuthProvider`:

```ts
interface DataProvider {
  getList(resource, params): Promise<{ rows: T[]; total: number }>
  getOne(resource, { id }): Promise<T>
  getMany(resource, { ids }): Promise<T[]>
  create(resource, { data }): Promise<T>
  update(resource, { id, data, previous? }): Promise<T>
  remove(resource, { id }): Promise<void>
  invoke(resource, action, params): Promise<unknown>
}
```

Ships `createRestDataProvider({ baseUrl, fetcher, headers })`; GraphQL/tRPC/Supabase are just
other implementations of the same interface. The HTTP client is shared with auth so tokens,
`401 → refresh → retry` (single-flight), and error normalization happen in one place —
that shared client is the real payoff of making auth pluggable in the first place.

**Hooks + generic UI** — `useList`, `useOne`, `useCreate`, `useUpdate`, `useDelete`,
`useAction`, with optimistic updates and cache invalidation; then `<ResourceTable>`,
`<ResourceForm>`, `<ResourceShow>` generated from `fields`, so a full CRUD screen is a
resource definition plus one line. (Decision D1 on the cache dependency.)

Files: `src/data/{types,defineResource,restProvider,httpClient,queryKeys}.ts`,
`src/data/hooks/*`, `src/data/components/*`.

---

## 3. Milestone B — access control (`/rbac`)

`hms-saas/fe-next` already solved this problem properly, and its model is better than what
I first proposed. Lift it wholesale (see §6 for the full mapping).

### The three-axis gate

Whether a module appears is three independent questions, and conflating them is the bug:

| Axis | Question | Source | On failure to read |
| --- | --- | --- | --- |
| **Catalog** | Does this module exist and is it active? | backend catalog endpoint | fall back to a static set |
| **Entitlement** | May this *tenant* run it — plan, license, facility type? | tenant endpoint | **fail open** (unconstrained) |
| **Permission** | May this *user* open it? | `/me/permissions` | **fail open** (no dev lockout) |

The fail-open/fail-closed direction is a real decision, not an oversight, and
`lib/tenant/server.ts:25` states the reason: *"a control-plane read that failed must not be
able to put a paywall in front of a hospital that has paid."* Entitlement fails closed only
where absence means the feature genuinely doesn't exist for that tenant. admin-kit should make
this a config field per axis (`onUnavailable: 'allow' | 'deny'`) rather than hard-coding it —
it's the kind of thing that must be a deliberate choice at install time.

### Access levels, not booleans

`AccessLevel = 'full' | 'view' | 'none'` (`fe-next/types/settings.ts:60`) with
`PermissionsMap = Record<string, AccessLevel>`. Read-only access is the single most common
real requirement and a boolean `can()` can't express it. The engine keeps the string-based
`resource:action` form for fine-grained checks but adds levels at module granularity.

### Merged codes

`accessCodes` lets one nav entry be granted by several permission codes, with the effective
level being the *strongest* held over the set (`levelForModule`, `registry.ts:363`) — how
fe-next merged Claims→Billing and Clinical Monitoring→Vitals without touching the backend.

### Config surface

```ts
access: {
  levels: true,                                   // 'full' | 'view' | 'none' vs boolean
  permissions: {
    endpoint: '/api/me/permissions',              // pluggable, like everything else
    onUnavailable: 'allow',                       // fail open — never lock out on a 500
  },
  entitlements: {
    endpoint: '/api/me/tenant',
    field: 'modules',                             // string[] of entitled codes
    onUnavailable: 'allow',
  },
  catalog: {
    endpoint: '/api/modules',                     // data-driven module list
    fallback: STATIC_MODULES,                     // nav never goes blank
  },
  roles: { admin: ['*'], editor: ['posts:*'] },   // role → permission expansion
  deny: { editor: ['users:delete'] },             // deny beats allow
}
```

- **Engine** (pure, isomorphic, testable): `levelFor(code)`, `can(code)`, `can('users:create')`,
  `canAny`, `canAll`, with optional record-level predicates for ownership rules.
- **Client**: `usePermissions()` → `{ permissions, can, levelFor }`, hydrated from the server
  with no client fetch (fe-next's `PermissionsProvider` pattern); `<Can do="users:create">`;
  `<RequirePermission>`.
- **Server**: `requireModule(code)`, `requireEntitlement(code)`, `requireAdmin()`,
  `assertPermission(session, 'users:create')`. fe-next's comment is the rule to enforce in
  docs: *"The nav filter is what makes the panel honest; this is what makes it a gate, since a
  hidden link is still a reachable URL."* Every generated page gets a guard.
- **Request-level dedupe**: wrap each resolver in React `cache` so the layout, the nav, and
  each page's guard share one fetch per request — fe-next found this was otherwise 2+ round
  trips per navigation for an answer that cannot change mid-request.

### The presentation overlay

The module *list* is data (backend catalog: code, title, order, active). Icon, group,
description, tile styling, and `accessCodes` are a frontend **overlay keyed by code**
(`MODULE_PRESENTATION`). A catalog entry with no overlay simply doesn't render. This is the
right seam for admin-kit: `config.modules` *is* the overlay, and the catalog is a pluggable
endpoint — so adding a module server-side makes it appear with no frontend deploy, while
presentation stays where presentation belongs.

Optional extra worth carrying over: tenant-flavored copy (`FacilityCopy` — a `default` string
plus per-tenant-type overrides, `registry.ts:110`) so one codebase can word a module
differently per install without forking the config.

Files: `src/rbac/{types,engine,levels,defineAccess}.ts`, `src/rbac/{hooks,components}/*`,
`src/rbac/server/{requireModule,requireEntitlement,assertPermission}.ts`, `src/rbac/screens/*`.

---

## 4. Milestone C — two panels (`/ui`)

The important idea from `admin-app-panel.md` is that the split is **by kind of work, not by
account type**. fe-next's original mistake was flipping the entire chrome on `isAdminUser`:
admins never saw the launcher, clinicians never saw a sidebar, and "the admin layout" was just
the clinical app with different nav. The corrected model:

- **App panel** (`LauncherShell`) — the launcher. Daily operations. *Every* account lands
  here, administrators included.
- **Admin panel** (`AdminShell`) — the sidebar. Configuration and administration, guarded at
  the layout. No daily work lives here.
- Crossing between them is the user menu, which offers whichever panel you are *not* in, plus
  a "Back to app" link pinned in the sidebar footer. Deliberately not a floating button —
  fe-next tried that and it competed with the dock for the same corner.

admin-kit ships both as `panels: { app: {...}, admin: {...} }`, either one disableable.

### `<AppShell>` / launcher anatomy

Structure, taken from `launcher-shell.tsx` and worth copying exactly:

```
h-dvh flex-col overflow-hidden          ← shell owns the viewport
  <LauncherTopbar/>   h-16, no background fill, sits on the canvas
                      grid-cols-[1fr_minmax(0,28rem)_1fr]: brand | search | actions
  <main> flex-1 flex-col overflow-y-auto
    <div class="flex-1">{children}</div>   ← plain block, NOT a flex item
    <Dock/>                                ← sticky bottom-0 mt-auto
  <footer> shrink-0                        ← outside the scrollport
```

Two hard-won details in that file that a naive implementation gets wrong, both worth encoding
in the kit rather than leaving to consumers:

- The content wrapper is a plain block, not a flex item. A page root of `mx-auto max-w-7xl`
  as a direct flex child sizes to its content instead of stretching, which silently narrowed
  every page to the width of its widest table.
- The dock is `sticky`, not `fixed`. `fixed` positions against the viewport and lands on top
  of the footer, which sits outside the scrolling `<main>`; fixing that with a bottom offset
  means hard-coding the footer height forever. Sticky pins it to the bottom of the
  *scrollport*: floats over content while there's more to scroll, comes to rest at the end.

Components:

| Component | Role |
| --- | --- |
| `<AppLauncher>` | The home view: greeting header + tile grid, RBAC-filtered |
| `<LauncherTile>` | Tile with tone palette, string icon key, optional live metric + stat footer |
| `<Dock>` | Sticky bottom-centre bar; `pointer-events-none`, children opt back in |
| `<QuickAccessBar>` | "Station" modules inline in the dock, `activeHref` marks the current one |
| `<PrimaryActionFab>` | The one record-creating action, rightmost in the dock, home view only |
| `<PanelSwitcher>` | In the user menu; offers the panel you're not in |

Behaviors to generalize:

- **Tiles vs dock is a config decision, not a size decision.** fe-next splits modules people
  *run their shift from* (tiles) from *stations they step into and back out of* (dock cells):
  given equal-weight cards the stations diluted the grid into equally-likely choices.
  So: `placement: 'tile' | 'dock'` per module.
- **The dock follows the user into its own routes** (`launcher-dock.tsx`) so hopping between
  two stations doesn't require returning home, and it marks the current cell with
  `aria-current`. It renders nothing elsewhere, since the home view carries its own dock.
- **Dock order is fixed by config, not by catalog order** — muscle memory must not shift when
  the backend reorders its response.
- **Featured layout**: when a designated primary module and a `accent: 'critical'` module are
  both granted, the top row is a 2-col + 1-col pair over a 3-up grid of the rest; otherwise a
  plain 3-up grid. Generalize as `emphasis: 'primary' | 'critical' | undefined` with the shell
  choosing the layout, so it degrades correctly when a user lacks either one.
- Greeting header with optional honorific handling is app-specific — expose it as a `header`
  slot with a `<LauncherGreeting>` helper rather than baking in hospital semantics.

### `<AdminShell>`

fe-next's version (`admin-shell.tsx`) is close to what the kit should ship, and closer than
admin-kit's current `AdminLayout`: permanent rail on `lg+`, slide-in drawer with overlay
below, collapsed state persisted to `localStorage`, drawer auto-closed on crossing the
desktop breakpoint, slide transition whose JS duration and CSS class are kept in sync via one
constant, `sidebar` and `navbar` override slots, and a `footer` slot on the sidebar itself.
One detail worth keeping: the admin topbar deliberately omits the global search, because that
search looks up records and has no meaning against a configuration page — so search is a
per-panel slot, not shell furniture.

Files: `src/ui/panels/{AppShell,AdminShell}.tsx`,
`src/ui/launcher/{AppLauncher,LauncherTile,Dock,QuickAccessBar,PrimaryActionFab}.tsx`,
`src/ui/admin/{Sidebar,SidebarNav,TopNavbar,Breadcrumb}.tsx`, `src/ui/styles.css`.

---

## 5. Milestone D — markdown docs generator (`/cli`)

A `bin` entry, `admin-kit`, that loads the consumer's `admin.config.ts` in Node (via `jiti`,
which is why the core must stay React-free) and writes docs *specific to their config* —
their cookie name, their endpoints, their roles — not generic boilerplate.

```
admin-kit init                 scaffold admin.config.ts, middleware.ts, login page, routes
admin-kit docs                 generate markdown into ./docs/admin
admin-kit docs --check         CI drift detection: fail if generated output differs
admin-kit docs --out … --format md|mdx --config …
```

Emitted files:

| File | Content derived from config |
| --- | --- |
| `getting-started.md` | install + copy-paste snippets using *their* paths and names |
| `auth.md` | provider, endpoint table, login/logout flow, required env vars |
| `resources.md` | per resource: endpoint table, fields, required permissions, page snippet |
| `permissions.md` | role → permission matrix, expanded through hierarchy and deny rules |
| `navigation.md` | nav/app tree annotated with who can see each entry |
| `configuration.md` | every key set, every default inherited |

Separately, the package's own API reference is generated from TSDoc
(`typedoc-plugin-markdown`) into `docs/api/` — that's a build step, not the CLI.

Files: `src/cli/{index,commands/init,commands/docs}.ts`, `src/cli/generators/*.ts`,
`src/cli/templates/*`.

---

## 6. Decisions needed

**D1 — cache for the data hooks.** Recommend `@tanstack/react-query` v5 as a peer dependency
required only by `/data`. Dedupe, optimistic updates, invalidation, and retries are ~1500
lines of well-trodden bug surface; hand-rolling them to stay zero-dep is the wrong trade for
a package other people ship to production. Alternative: keep `/data` cache-agnostic (accept a
`cacheAdapter`) and ship the react-query adapter as the documented default.

**D2 — styling.** Recommend shipping compiled vanilla CSS (`dist/styles.css`, `.ak-*` classes
driven by the existing custom-property tokens) with per-slot `classNames` overrides and a
headless mode. It works on install with zero consumer setup, which the current Tailwind
approach does not, and it does not force Tailwind on consumers. Alternative: commit to
Tailwind, ship a preset, and document the `node_modules` content glob.

**D3 — permission source of truth.** *Answered by the reference app.* Permissions come from
a `/me/permissions` endpoint returning `code → AccessLevel`, resolved server-side from the
user's role, fetched once per request and hydrated into a client provider with no client
fetch. Config `roles` are used only to expand roles → permissions when a backend sends roles
alone. Entitlement and catalog are separate axes with their own endpoints (§3).

**D4 — launcher reference.** *Resolved* — `hms-saas/fe-next` read, mapped in §6.

**D5 — how far to carry the tenant/entitlement axis.** fe-next's third gate assumes a
control-plane API (`/me/tenant` → `modules: string[]`). Recommend shipping it as **optional**:
if `access.entitlements` is unset the axis collapses to always-allow and no request is made,
so single-tenant installs pay nothing for it. Given the `propfit-license` service sitting
alongside this repo, you may want the entitlement resolver pluggable enough to point at a
license server rather than only a tenant row — worth confirming.

---

## 7. Reference implementation — `hms-saas/fe-next`

Read at `/home/jicoy/hms-saas`. It is a working, considerably more mature version of what this
kit is trying to generalize, plus two design docs that record the reasoning:
`admin-app-panel.md` (the two-panel split) and `permission-driven-module-system.md` (the
permission plumbing). What to lift, and what to leave behind:

| fe-next | → admin-kit | Note |
| --- | --- | --- |
| `lib/modules/registry.ts` (`AppModule`, `MODULE_PRESENTATION`, `buildAppModules`) | `defineModule` + catalog overlay | The core model. Data-driven list + presentation overlay keyed by code |
| `ModuleIconKey` string keys | serializable config icons | Fixes finding #9 — the RSC boundary |
| `levelForModule` / `accessCodes` | `levelFor()` + merged codes | Strongest level over a code set |
| `lib/auth/permissions.ts` (`requireModule`, `requireAdmin`, `requireEntitlement`) | `/rbac/server` guards | Per-page gates; the fail-open/closed split is deliberate |
| `lib/tenant/server.ts` (`getModuleGate`) | optional entitlement axis | Third gate; recommend optional (D5) |
| `providers/permissions-provider.tsx` | `usePermissions()` | Server-hydrated, no client fetch |
| `components/layout/launcher-*.tsx`, `operational-hub.tsx`, `fab-dock.tsx`, `quick-access-bar.tsx` | `<AppShell>` + launcher parts | Anatomy in §4, including the sticky-dock and flex-child traps |
| `components/layout/admin-shell.tsx`, `sidebar.tsx` | `<AdminShell>` | Better than the current `AdminLayout`; rail/drawer machinery works |
| `React cache()` on every resolver | per-request dedupe | Otherwise 2+ identical fetches per navigation |
| Hospital semantics — professions, honorifics, ER triage, metrics, `FacilityType` | **not** carried over | Exposed as slots and config; the kit stays domain-neutral |
| `components/layout/hub-modules.ts` `QUICK_ACCESS_CODES` hardcode | `placement: 'tile' \| 'dock'` per module | Config, not a constant in the kit |

Two things to check against that codebase before building each milestone, since they'll
otherwise be discovered late: it runs a **modified Next 16** where `cookies()` is async and
middleware is `proxy.ts` rather than `middleware.ts` (`fe-next/AGENTS.md`), and its API client
conventions (`lib/api/client.ts`, `lib/api/endpoints.ts`) are the closest thing to a spec for
what Milestone A's data provider has to be able to express. If admin-kit is ever meant to be
adopted *by* fe-next, Milestone A's `DataProvider` should be validated by reimplementing
`settingsApi` on top of it — that's the honest test of whether the abstraction holds.

---

## 8. Hardening (runs alongside every milestone)

- `examples/app-router` + `examples/pages-router` built in CI — the only thing that would have
  caught all three P0 bugs.
- Publish gate: `npm pack` + `publint` + `attw` + import smoke tests for ESM and CJS.
- Vitest + RTL. Priority coverage: `verifyJWT` (tampered signature, alg confusion, `none`,
  expired, `nbf`, malformed), cookie parse/serialize, RBAC engine truth table (wildcards,
  hierarchy, deny precedence), `buildNav` merge/order, `filterNav` pruning, resource
  mapping round-trips, middleware redirect/passthrough decisions.
- Real eslint config (the `lint` script currently references one that doesn't exist).
- Gate the auto-publish-on-push CI on green typecheck + lint + tests.
- `.gitignore` `creds`, and rotate its contents.

---

## 9. Sequencing

| Version | Content | Why here |
| --- | --- | --- |
| **0.2.0** | P0 fixes, secret split, HttpOnly default, **serializable config + icon-key registry**, `AdminConfigContext`, examples, tests, lint, publish gate | Nothing else matters while `import` fails on a clean install. The serializability fix (#9) has to land first: server-resolved nav is a precondition for the access model and both panels |
| **0.3.0** | Milestone A — `/data` | RBAC screens and all CRUD UI depend on it |
| **0.4.0** | Milestone B — `/rbac`: three-axis gate, levels, server guards | Consumes A (permissions/entitlements/catalog are all endpoints), which proves A's design |
| **0.5.0** | Milestone C — `/ui` both panels | Consumes A + B for nav filtering and resource screens |
| **0.6.0** | Milestone D — `/cli` docs | Documents whatever exists; goes last so it isn't rewritten each milestone |
| **1.0.0** | API freeze, migration guide, docs site | |

0.2.0 contains breaking changes (config split, layout props moving to context). Pre-1.0 that's
acceptable, but each needs a CHANGELOG entry and a codemod note.

---

## Status — implemented

All five milestones are built, `pnpm verify` is green (typecheck, lint, 194
tests, build, import smoke test, publint, are-the-types-wrong), and
`examples/app-router` builds and runs against the packaged output.

Three bugs surfaced only once the example actually ran, which is the argument for
having it:

1. **Duplicated React contexts.** Each client entry bundled its own copy of the
   context modules, so `<AdminProvider>` wrote to one object and `<AdminShell>`
   read another — every hook threw "must be used inside `<AdminProvider>`". Fixed
   by building the client entries with code splitting.
2. **`verifyJWT` failed in the edge runtime**, which rejects an `ArrayBuffer`
   constructed in another realm. Fixed by passing typed arrays.
3. **The query cache never notified React.** `DataStore` mutated entries in
   place, so `useSyncExternalStore` saw identical identity and every CRUD hook
   stayed loading forever. Fixed by replacing snapshots on change.

A fourth 0.1.8 shipping bug turned up during the build, beyond the three in §0:
`tsconfig` set `jsx: "preserve"`, so esbuild emitted `React.createElement` with
no React import — 53 call sites in the published `dist/client.js`, every one of
which throws at runtime. Verified against the registry tarball.

Two design constraints were discovered by the same route and are worth
remembering, because both look like they work until an RSC boundary is involved:

- **Icons cannot be passed to `<AdminProvider>` from a server component.** They
  are components. The registry has to be imported inside a client module — the
  example's `app/providers.tsx` is that file.
- **Callback props force a page to be a client component.** `<ResourceTable
  hrefFor={fn}>` did exactly that, so `hrefFor` now also accepts a serializable
  template (`"/admin/users/:id"`).

Deviations from the plan as written:

- **D1** — the data hooks ship a small dependency-free query cache instead of
  requiring React Query, which is the alternative the decision listed. The
  `DataProvider` interface is unchanged, so a React Query adapter remains a
  drop-in.
- **D2** — shipped compiled vanilla CSS over the token set, as recommended. The
  Tailwind route stays open via `className` on every component.
- **Deny semantics** — role hierarchy accumulates grants but not restrictions.
  The example caught the alternative: with `hierarchy: { admin: ['manager'] }`
  and `deny: { manager: ['users:delete'] }`, an admin was refused a delete.
- Everything landed in one pass rather than across 0.2.0–0.6.0. The version is
  still 0.1.8; `./scripts/release.sh minor` cuts 0.2.0 from the CHANGELOG.
