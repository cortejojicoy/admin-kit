# @cortejojicoy/admin-kit

A Next.js admin toolkit you configure rather than fork. Declare your endpoints,
your permissions and your modules once; get a launcher panel, a sidebar panel,
generated CRUD screens, and documentation of your own installation.

**📖 [Documentation](https://cortejojicoy.github.io/admin-kit/)** ·
[Getting started](https://cortejojicoy.github.io/admin-kit/docs/getting-started/) ·
[API reference](https://cortejojicoy.github.io/admin-kit/docs/api-reference/) ·
[Changelog](CHANGELOG.md)

```bash
pnpm add @cortejojicoy/admin-kit
npx admin-kit init        # scaffold config, middleware, panels and routes
npx admin-kit docs        # generate docs for *your* config
```

App Router and Pages Router; React 19; Next 15 and 16; Node 20.9+.

## What it is

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

## A taste

```ts
// admin.config.ts — plain data, imported by both server and client
import { defineAdminConfig } from '@cortejojicoy/admin-kit'

export const adminConfig = defineAdminConfig({
  app: { name: 'Axiomkit', logoIconKey: 'grid' },

  auth: {
    provider: 'jwt',
    jwt: {
      endpoints: { login: '/api/auth/login', me: '/api/auth/me' },
      tokenStorage: 'server-cookie',   // HttpOnly; the browser never holds the token
    },
  },

  access: {
    roles: { admin: ['*'], manager: ['users:*'] },
    deny:  { manager: ['users:delete'] },
  },

  resources: [
    {
      name: 'users',
      endpoints: {
        list:   '/api/users',
        remove: { method: 'DELETE', path: '/api/users/:id' },
      },
      permissions: { list: 'users:list', remove: 'users:delete' },
    },
  ],
})
```

```tsx
// a full list screen
import { ResourceTable } from '@cortejojicoy/admin-kit/ui'

export default function UsersPage() {
  return <ResourceTable resource="users" hrefFor="/admin/users/:id" />
}
```

The [five-step walkthrough](https://cortejojicoy.github.io/admin-kit/docs/getting-started/)
takes it from here.

## One thing worth reading before you ship

Three layers look like authorization and only one of them is:

| Layer | Job | Not its job |
| --- | --- | --- |
| `createAdminMiddleware` | Redirect a signed-out browser to the login page | Authorization. Next middleware has been bypassable (CVE-2025-29927), and a token can be revoked after it was signed |
| `<Can>`, `<RequirePermission>` | Hide controls the user cannot use | Authorization. A hidden button is still a reachable endpoint |
| `requireModule`, `requireAdmin`, `assertPermission` | **Refuse the request** | — |

[Access control](https://cortejojicoy.github.io/admin-kit/docs/access-control/)
explains why, and what each axis does when its source cannot be read.

## Documentation

The docs live in [`docs/`](docs/) as markdown and are published at
[cortejojicoy.github.io/admin-kit](https://cortejojicoy.github.io/admin-kit/).

| Page | Contents |
| --- | --- |
| [Getting started](docs/getting-started.md) | Install, scaffold, and a working install in five steps |
| [Live demo](docs/demo.md) | What each of the three accounts sees, and why |
| [Configuration](docs/configuration.md) | Every `AdminConfig` key and every default |
| [Authentication](docs/authentication.md) | JWT, OAuth and custom; where the token lives |
| [Access control](docs/access-control.md) | The three axes, levels, roles, and the server guards |
| [Navigation & panels](docs/navigation.md) | Launcher, sidebar, tiles, dock, icons |
| [Resources & CRUD](docs/resources.md) | Endpoints, fields, generated screens, hooks |
| [Theming](docs/theming.md) | The token list and how to override it |
| [CLI](docs/cli.md) | `admin-kit init` and `admin-kit docs` |
| [Versioning & releases](docs/releases.md) | Tag-driven releases and the publish gate |
| [API reference](docs/api-reference.md) | Every export, by sub-path |

Separately, `admin-kit docs` generates documentation of **your** installation —
your endpoints, your role matrix, your screens — and `--check` in CI stops it
from drifting. See [`examples/app-router/docs`](examples/app-router/docs) for
real output.

## Example

[`examples/app-router`](examples/app-router) is a complete installation:
HttpOnly cookie auth, three roles with inheritance and a deny rule, both panels,
a generated CRUD screen, and route handlers that actually refuse unauthorized
requests. It is built in CI, which is what catches the class of bug that
typechecks cleanly and ships broken.

```bash
pnpm install
pnpm build                                 # the example imports the built kit
pnpm --filter @examples/app-router dev
# sign in with any seeded email and the password "demo"
```

[docs/demo.md](docs/demo.md) is a tour of what each account sees and why.

### Deploying it

The demo needs a Node server — every route is server-rendered on demand — so it
cannot be hosted on GitHub Pages beside the documentation site. On Vercel, set
**Root Directory** to `examples/app-router` and enable *Include source files
outside of the Root Directory*; [`examples/app-router/vercel.json`](examples/app-router/vercel.json)
supplies install and build commands that step up to the repository root, because
the example depends on the kit through `workspace:*` and the kit must be built
first. Set `JWT_SECRET`, or it falls back to a development secret.

Once it is deployed, point the documentation site at it and the "Try the demo"
buttons appear:

```bash
# .env at the repository root — pnpm site/site:dev load it automatically
SITE_DEMO_URL=https://your-demo.vercel.app
```

The variable needs a value; an empty `SITE_DEMO_URL=` is falsy and the buttons
stay hidden.

## Development

```bash
pnpm verify      # typecheck + lint + test + build + smoke + publint + attw
pnpm test        # vitest
pnpm build       # tsup + stylesheet copy
pnpm site:dev    # preview the documentation site on :4321
```

`pnpm verify` is the publish gate; `tool/release.sh` runs it before it will tag
anything. Releases are tag-driven — see
[Versioning & releases](docs/releases.md).

## License

[MIT](LICENSE)
