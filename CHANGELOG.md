# Changelog

All notable changes to `@cortejojicoy/admin-kit` will be documented in this file.
Versioning follows [Semantic Versioning](https://semver.org/):

- **PATCH** — bug fix, no API change (consumers auto-update safely)
- **MINOR** — new feature, backwards compatible (consumers auto-update safely)
- **MAJOR** — breaking change (consumers must opt in)

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
-

### Changed
-

### Fixed
-

## [0.2.0] - 2026-09-08

### Fixed — shipping bugs in 0.1.8

Four defects that all typechecked cleanly and all reached the registry. An
example app is now built in CI, plus an import smoke test, `publint` and
`are-the-types-wrong`, because none of these are visible to `tsc`.

- **The package could not be imported at all.** The `exports` map pointed
  `import` at `dist/*.mjs`, which tsup never emitted, and `require` at the ESM
  `dist/*.js`. Filenames now match the build, with per-condition `types`.
- **`"use client"` was stripped from the client bundles.** `tsup`'s `treeshake`
  option re-bundles esbuild's output through rollup, which discards the
  directive — so every App Router consumer failed at build time. Client entries
  now carry it via a banner and skip tree-shaking.
- **`createAdminMiddleware` blanked every authenticated page.** Its passthrough
  returned `new Response(null, { status: 200 })`; it now returns
  `NextResponse.next()`.
- **Every component threw `React is not defined`.** `tsconfig` set
  `jsx: "preserve"`, so esbuild emitted `React.createElement` with no import.
  Now `react-jsx`.

### Fixed — found by running the example

- **React contexts were duplicated across entry points.** Each client entry
  bundled its own copy, so `<AdminProvider>` wrote to one context object while
  `<AdminShell>` read another and every hook threw "must be used inside
  `<AdminProvider>`". The client entries are now built with code splitting so
  the contexts are singletons.
- **`verifyJWT` failed in the edge runtime.** It copied the key into a fresh
  `ArrayBuffer`, which Next's edge sandbox rejects as belonging to another
  realm. It passes typed arrays now.
- **The query cache never notified React.** `DataStore` mutated entries in
  place, so `useSyncExternalStore` saw identical object identity and every CRUD
  hook stayed loading forever. Snapshots are now replaced on each change.

### Fixed — correctness

- `verifyJWT` takes an explicit `algorithms` allowlist (default `['HS256']`),
  closing algorithm confusion by construction rather than by omission, plus
  `clockTolerance` and non-throwing handling of malformed signatures.
- `ModuleRegistry.widgets` resolved to `never`, so registered widgets could not
  be rendered. Now `createPluginRegistry` with a usable `ComponentType`.
- `serializeCookie` emits canonical `SameSite` capitalization.
- Trailing-wildcard permissions (`users:*`) no longer match the bare code
  `users`, which had silently widened roles.
- `ThemeProvider` guards `window.matchMedia` separately from `window`.

### Added

- **Pluggable CRUD (`/data`).** `DataProvider` interface plus
  `createRestDataProvider`: every operation is an endpoint you declare, with
  wire-format mapping in both directions, configurable list-parameter names,
  normalized errors including field-level validation, and any number of named
  non-CRUD actions. Hooks: `useList`, `useOne`, `useCreate`, `useUpdate`,
  `useDelete`, `useAction`, over a dependency-free query cache with request
  de-duplication, staleness, optimistic updates and prefix invalidation.
- **Three-axis access control (`/access`).** Catalog, entitlement and permission
  as separately configured gates, each with its own `onUnavailable` direction;
  `AccessLevel` of `none`/`view`/`full`; wildcard patterns; role hierarchy;
  deny rules that beat every grant. `usePermissions`, `useCan`, `<Can>`,
  `<RequirePermission>`, `<RequireAuth>`, and the server gates `requireModule`,
  `requireEntitlement`, `requireAdmin`, `assertPermission`, `resolveModules`.
- **Two panels (`/ui`).** `<AppShell>` + `<AppLauncher>` (launcher home, tiles,
  quick-access dock that follows the user into its own routes, featured layout
  that degrades by permission) and `<AdminShell>` (collapsible rail, mobile
  drawer, persisted state). Plus `<UserMenu>` with the panel switch, a login
  page with open-redirect-safe `next` handling, and generated
  `<ResourceTable>` / `<ResourceForm>` / `<ResourceShow>`.
- **A stylesheet that ships.** `@cortejojicoy/admin-kit/styles.css` — plain CSS
  over custom-property tokens, with light and dark palettes. 0.1.x emitted
  Tailwind utility classes with no Tailwind build and no CSS in the tarball, so
  nothing was styled at all.
- **`admin-kit` CLI.** `admin-kit init` scaffolds a working installation;
  `admin-kit docs` generates markdown from *your* config — endpoint tables, a
  role → permission matrix, annotated navigation, per-resource snippets — and
  `--check` fails CI when it drifts.
- **Serializable config.** String `iconKey`s resolved through an icon registry,
  declarative visibility, `serializeConfig()` and `findUnserializable()`.
- **Server-only config.** `defineAdminServerConfig` keeps the JWT secret in a
  separate file that client components never import.
- **`server-cookie` token storage**, now the default: the login route sets an
  `HttpOnly; Secure` cookie and the browser never holds the token. Helpers
  `sessionCookie()` and `clearSessionCookie()`.
- Tests (194), an eslint config, an `examples/app-router` app built in CI, and
  `pnpm verify` as the publish gate.
- **Tag-driven release tooling** in `tool/`, adapted from `trackbnb-flutter`.
  `tool/version.py` owns a staged version scheme (`alpha` < `beta` < `rc` <
  `lts`, then `promote`) with git tags as the source of truth and
  `package.json` as a derived artifact; `tool/release.sh` runs the guarded
  sequence (verify → promote CHANGELOG → sync → commit → tag → push). 27 tests
  cover the progression. Pre-releases publish under their own npm dist-tag, so
  `npm install` keeps serving the stable release.

### Changed — breaking

Pre-1.0, so these land in a minor. Each has a mechanical migration.

- `NavItem.icon: ReactNode` → `iconKey: string`, resolved through
  `<AdminProvider icons={…}>`. `NavItem.visible` / `NavSection.visible`
  predicates are replaced by `roles`, `permissions`, `accessCodes` and
  `requiredLevel`. Both existed to make the config unserializable.
- `<AdminLayout config Link currentPath>` → `<AdminShell>` with no props;
  config, router and pathname come from context. `withAdminLayout` is gone.
- `AppRouterGuard` / `PagesRouterGuard` → one `<RequireAuth>`.
- `filterNav(sections, user)` → `filterNav(sections, accessEngine)`.
- `buildNav(sections, modules)` → `buildNav({ sections, plugins, modules })`.
- `AdminModule` → `AdminPlugin` (code-bearing feature packs), with
  `ModuleDescriptor` as the new, serializable presentation overlay.
  `config.modules` now holds descriptors; plugins move to `config.plugins`.
- `config.auth.jwt.secret` is deprecated in favour of `AdminServerConfig`, and
  is stripped by `serializeConfig()`.
- `tokenStorage` default changed from a script-readable cookie to
  `server-cookie`. The old behaviour is `'js-cookie'`, which is documented as
  XSS-exposed.
- `LoginPageConfig.logo` / `.component` removed; pass your own component.
- Dashboard primitives (`StatCard`, `ChartCard`, `ActivityFeed`) removed in
  favour of `Card` and the generated resource screens.
- `getServerSession(config, req)` takes a third options argument carrying the
  secret.
- Minimum peer `next` widened to `>=15`; `jiti` is an optional peer used only
  by the CLI.
- **Releases are cut from tags, not from pushes.** The auto-bump-on-push CI job
  is gone: it cannot coexist with tag-driven versioning, and it is how v0.1.8
  reached the registry with no tag pointing at it. `scripts/release.sh` and
  `scripts/update-changelog.mjs` are replaced by `tool/release.sh` and
  `tool/version.py changelog`, and the `npm version` lifecycle hooks are
  removed. Use `./tool/release.sh <step>`.

## [0.1.0] - 2026-05-24

### Added
- Initial scaffold: pluggable auth (JWT / OAuth / custom), config-driven sidebar,
  module registry, App Router + Pages Router adapters, edge-safe middleware factory,
  theme tokens, default login page, dashboard primitives (StatCard, ChartCard, ActivityFeed).
