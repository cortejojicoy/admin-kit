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

The workflow lives at [.github/workflows/ci.yml](.github/workflows/ci.yml). It's **push-driven**: every commit to `main` auto-publishes a new version.

| Trigger                                          | What happens                                                |
| ------------------------------------------------ | ----------------------------------------------------------- |
| `push` to `main` (normal commit)                 | `verify` + `release-on-push` → bump + tag + publish to npm  |
| `push` to `main` (release commit, has `[skip ci]`) | nothing — loop guard                                      |
| `pull_request` to `main`                         | `verify` only — never publishes                             |
| `push` of a `v*.*.*` tag                         | `verify` + `publish-on-tag` → publish that tag's version    |
| `workflow_dispatch` (manual)                     | `verify` + `release-on-push` with chosen bump               |

**Setup (one-time):**

1. **npmjs.com → Trusted Publishers** (under your org `@kukux` or directly on the package settings once it exists).
   Add a new GitHub Actions trusted publisher:

   | Field | Value |
   | --- | --- |
   | Package | `@kukux/admin-kit` |
   | Organization/user | (your GitHub username/org owning the repo) |
   | Repository | `admin-kit` |
   | Workflow filename | `ci.yml` |
   | Environment | (leave blank) |

   This replaces the long-lived `NPM_TOKEN` — the workflow gets a short-lived OIDC token at publish time. No secret in GitHub needed.

2. **GitHub repo → Settings → Actions → General → Workflow permissions** → enable **Read and write** (so CI can push the bump commit and tag).

That's it. No `NPM_TOKEN` secret, no 2FA bypass. The package will publish with a **verified provenance attestation** (the green "Verified" badge on the npm page), proving it was built from the exact commit shown.

### How the bump size is chosen

For each push to `main`, CI reads the head commit message and picks a bump level. Precedence (first match wins):

1. **`workflow_dispatch` input** — the dropdown you pick in the UI overrides everything.
2. **Explicit tag in the message:** `[major]`, `[minor]`, or `[patch]` anywhere in the commit.
3. **Conventional commits:**
   - `feat!: ...` or contains `BREAKING CHANGE` → **major**
   - `feat: ...` / `feat(scope): ...` → **minor**
4. **Default** → **patch**

Examples:

| Commit message                              | Bump   |
| ------------------------------------------- | ------ |
| `fix: race in sidebar collapse`             | patch  |
| `chore: bump deps`                          | patch  |
| `feat: add OAuth callback handler`          | minor  |
| `feat(auth): GitHub provider`               | minor  |
| `feat!: drop AdminProvider props`           | major  |
| `refactor: rewrite layout [minor]`          | minor (override) |
| `docs: tweak readme [skip release]`         | **no release** |

### Opting out per-commit

Include `[skip release]` anywhere in the commit message and that push won't publish. Use it for README/docs/CI tweaks that shouldn't mint a version.

### The other two paths (kept as escape hatches)

- **Manual tag** — `git tag v0.2.0 && git push origin v0.2.0`. CI syncs `package.json` to the tag and publishes. Useful if you bumped locally with [`./scripts/release.sh`](scripts/release.sh) or want to ship an exact version.
- **Manual dispatch** — Actions tab → `ci` → **Run workflow** → pick the bump. Has a `dry_run` toggle for rehearsals.

In all three paths the **git tag is the source of truth**; `package.json` version in `main` can lag behind the latest npm version when CI publishes from a tag without committing back.

### Loop prevention

CI's release commit message is `chore(release): vX.Y.Z [skip ci]`. GitHub honors `[skip ci]` and won't re-trigger the workflow. As a belt-and-suspenders measure, the `release-on-push` job also has an `if:` that skips messages starting with `chore(release):` — so even if `[skip ci]` is stripped somehow, the loop still can't form.

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
