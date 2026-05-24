# @kukux/admin-kit

A pluggable Next.js 16 admin panel kit. Drop in a config, get an authenticated dashboard with a customizable sidebar, JWT/OAuth/custom auth, and modules.

- **Next.js 16 / React 19** — Works with both App Router and Pages Router.
- **Pluggable auth** — JWT by default; switch to OAuth or supply a custom provider.
- **Config-driven sidebar** — Sections, items, badges, roles, and per-user filtering.
- **Modules** — Self-contained feature packs that contribute nav, providers, and dashboard widgets.
- **Edge-safe middleware** — Token verification at the edge via Web Crypto.
- **Theme tokens** — Override colors and radii via CSS variables.

## Install

```bash
pnpm add @kukux/admin-kit
# or
npm install @kukux/admin-kit
```

Peer deps (must be installed in the consumer): `next@>=16`, `react@>=19`, `react-dom@>=19`.

## 1. Define your config

```ts
// admin.config.ts
import { defineAdminConfig } from '@kukux/admin-kit'

export const adminConfig = defineAdminConfig({
  app: { name: 'Acme Admin' },
  auth: {
    provider: 'jwt',
    jwt: {
      endpoints: {
        login: '/api/auth/login',
        me: '/api/auth/me',
        logout: '/api/auth/logout',
      },
      secret: process.env.JWT_SECRET, // only read on the server / in middleware
      cookieName: 'acme_token',
    },
    loginPage: { path: '/login', title: 'Sign in to Acme' },
    publicRoutes: ['/login', '/api/auth'],
  },
  navigation: {
    sections: [
      {
        label: 'Workspace',
        items: [
          { label: 'Dashboard', href: '/' },
          { label: 'Users', href: '/users', roles: ['admin'] },
        ],
      },
    ],
  },
})
```

## 2. App Router

```tsx
// app/layout.tsx
import { AdminProvider, AdminLayout, AppLink, useAppPathname } from '@kukux/admin-kit/client'
import { adminConfig } from '@/admin.config'
import { resolveConfig } from '@kukux/admin-kit'

const resolved = resolveConfig(adminConfig)

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <AdminProvider config={adminConfig}>
          <Shell>{children}</Shell>
        </AdminProvider>
      </body>
    </html>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = useAppPathname()
  return (
    <AdminLayout config={resolved} Link={AppLink} currentPath={pathname}>
      {children}
    </AdminLayout>
  )
}
```

## 3. Pages Router

```tsx
// pages/_app.tsx
import { AdminProvider } from '@kukux/admin-kit/client'
import { adminConfig } from '@/admin.config'

export default function App({ Component, pageProps }) {
  return (
    <AdminProvider config={adminConfig}>
      <Component {...pageProps} />
    </AdminProvider>
  )
}

// pages/dashboard.tsx
import { withAdminLayout } from '@kukux/admin-kit/client'
import { resolveConfig } from '@kukux/admin-kit'
import { adminConfig } from '@/admin.config'

function DashboardPage() { return <div>Hello</div> }
export default withAdminLayout(DashboardPage, { config: resolveConfig(adminConfig), title: 'Dashboard' })
```

## 4. Edge middleware

```ts
// middleware.ts (consumer root)
import { createAdminMiddleware } from '@kukux/admin-kit/middleware'
import { adminConfig } from './admin.config'

export default createAdminMiddleware(adminConfig)
export const config = { matcher: ['/((?!_next|api/auth|favicon).*)'] }
```

## 5. Server-side session

```ts
// app/api/me/route.ts
import { getServerSession } from '@kukux/admin-kit/server'
import { adminConfig } from '@/admin.config'

export async function GET(req: Request) {
  const session = await getServerSession(adminConfig, req)
  return Response.json({ user: session?.user ?? null })
}
```

## Sub-path exports

| Sub-path                          | Purpose                                                |
| --------------------------------- | ------------------------------------------------------ |
| `@kukux/admin-kit`                | Config helpers + types (safe everywhere)              |
| `@kukux/admin-kit/client`         | React components & hooks (client components)          |
| `@kukux/admin-kit/server`         | `getServerSession`, `verifyJWT`, cookie helpers       |
| `@kukux/admin-kit/middleware`     | `createAdminMiddleware` (edge-safe)                   |

## Modules

```ts
import type { AdminModule } from '@kukux/admin-kit'

export const billingModule: AdminModule = {
  id: 'billing',
  navSections: [{
    label: 'Billing',
    items: [{ label: 'Invoices', href: '/billing/invoices' }],
  }],
  enabled: ({ user }) => user?.roles?.includes('admin') ?? false,
}

// then add to config.modules
```

## Versioning

We follow [Semantic Versioning](https://semver.org/) — the `MAJOR.MINOR.PATCH` triplet:

```
 1.4.2
 │ │ └── PATCH — bug fix, no API change          (consumers auto-update safely)
 │ └──── MINOR — new feature, backwards compat   (consumers auto-update safely)
 └────── MAJOR — breaking change                 (consumers must opt in)
```

What counts as which:

| Change                                                  | Bump    |
| ------------------------------------------------------- | ------- |
| Fix a sidebar render bug, JWT cookie parsing fix        | PATCH   |
| Add a new optional prop, add a new module slot          | MINOR   |
| Add a new sub-path export (no behavior change)          | MINOR   |
| Rename a public prop, remove an export, drop Next 16    | MAJOR   |
| Change the shape of `AdminConfig.auth`                  | MAJOR   |
| Change a default that consumers depended on             | MAJOR   |

Document every change in `CHANGELOG.md` under `## [Unreleased]` before
cutting a release — the release script promotes that section to the new
version automatically.

## Releasing

You can bump + publish in one command. Both forms work:

**Option A — guarded script (recommended):**

```bash
./scripts/release.sh patch   # 0.1.0 -> 0.1.1
./scripts/release.sh minor   # 0.1.0 -> 0.2.0
./scripts/release.sh major   # 0.1.0 -> 1.0.0
```

It refuses to release from a dirty tree or a non-`main` branch, runs
typecheck + build, bumps the version, updates the CHANGELOG, commits,
tags, pushes, then publishes.

**Option B — raw npm scripts:**

```bash
npm run release:patch && npm run publish:npm
npm run release:minor && npm run publish:npm
npm run release:major && npm run publish:npm
```

These wire into npm's `version` lifecycle:

| Hook            | What runs                                        |
| --------------- | ------------------------------------------------ |
| `preversion`    | typecheck + build                                |
| `version`       | promote `[Unreleased]` → new version in CHANGELOG |
| `postversion`   | `git push --follow-tags`                         |
| `prepublishOnly` | clean + build before `npm publish`              |

## Publishing to npm

`@kukux/admin-kit` is a **scoped** package, so the first publish needs `--access public`:

```bash
# one-time
npm login                              # browser-based login to npmjs.com

# every release (handled by scripts/release.sh)
npm publish --access public            # or: npm run publish:npm
```

> "packagist" is the PHP/Composer registry — not relevant here. The JavaScript
> ecosystem publishes to **npm** (https://www.npmjs.com). The same tarball
> can also be mirrored to GitHub Packages by changing `publishConfig.registry`.

### CI/CD (GitHub Actions)

The workflow lives at [.github/workflows/ci.yml](.github/workflows/ci.yml) and has three paths:

| Trigger                                | What happens                                                |
| -------------------------------------- | ----------------------------------------------------------- |
| Push or PR on `main`                   | `verify` job: typecheck + build + `npm pack --dry-run`      |
| Push of a `v*.*.*` tag                 | `verify` then `publish` to npm + GitHub release             |
| Manual `workflow_dispatch` w/ bump arg | `verify` then `release` (bump + tag + push + publish in CI) |

**Setup (one-time):**

1. Generate an [npm automation token](https://docs.npmjs.com/creating-and-viewing-access-tokens) (granular, scope `@kukux`, publish-only).
2. In the GitHub repo: `Settings → Secrets and variables → Actions → New repository secret` → name it `NPM_TOKEN`.
3. `Settings → Actions → General → Workflow permissions` → enable **Read and write** (so the dispatch job can push the bump commit and tag).

**Cutting a release (three equivalent paths):**

- **Local script:** `./scripts/release.sh minor` — bumps locally, pushes tag, CI publishes on the tag.
- **CI-only:** GitHub UI → Actions → `ci` → `Run workflow` → choose `patch`/`minor`/`major`. CI bumps, tags, pushes, publishes — your laptop never sees an npm token.
- **Manual tag:** `git tag v0.2.0 && git push origin v0.2.0`. CI syncs `package.json` to the tag and publishes. Use this when you've already committed everything and just want to mint a version.

The **git tag is the source of truth**. When CI publishes from a tag, it overwrites `package.json` version in the runner workspace to match the tag, then publishes. So `package.json` in the repo can lag behind the latest published version — that's fine; the tag is what matters.

The dispatch job has a `dry_run` toggle that runs through the full lifecycle (preversion → version → postversion) without pushing tags or publishing — useful for verifying the changelog promotion before going live.

## What gets pushed where

Two separate allowlists control this — don't conflate them.

**Git (`.gitignore`)** — what we *commit* to the repo:

| Tracked in git              | Ignored in git                                      |
| --------------------------- | --------------------------------------------------- |
| `src/**`                    | `node_modules/`, `dist/`, `.next/`, `.cache/`       |
| `package.json`, `tsconfig.json`, `tsup.config.ts` | `*.log`, `.env`, `.env.*` (except `.env.example`) |
| `scripts/**`, `examples/**` (source only) | `examples/*/node_modules`, `examples/*/.next` |
| `README.md`, `CHANGELOG.md`, `LICENSE` | `coverage/`, `.eslintcache`, `*.tsbuildinfo`  |

`dist/` is intentionally **not** committed — it's built fresh in CI and shipped
to npm only.

**npm (`files` in `package.json`)** — what we *publish* to the registry:

```json
"files": ["dist", "README.md", "LICENSE"]
```

That's a whitelist, so consumers only download `dist/`, the README, and the
LICENSE. Source `.ts` files, tests, scripts, and configs **never** go to npm.
We don't use `.npmignore` (the `files` field is single-source-of-truth — using
both invites drift). Run `npm pack --dry-run` to preview the exact tarball
contents before publishing.

## License

MIT
