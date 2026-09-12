# CLI

The package ships one binary, `admin-kit`, with two commands.

```bash
admin-kit init [options]     # scaffold config, middleware, panels and routes
admin-kit docs [options]     # generate markdown docs from your admin config
admin-kit --version
admin-kit --help
```

Run it with `npx admin-kit …` (or `pnpm exec admin-kit …`) from your project
root. It adds nothing to your install: the flag parser is about eighty lines,
because two commands and eight flags do not justify a dependency, and a CLI
shipped inside a library should not grow a consumer's node_modules.

## `admin-kit init`

```bash
npx admin-kit init
npx admin-kit init --router pages --name "Axiomkit"
npx admin-kit init --force
```

| Flag | Default | Meaning |
| --- | --- | --- |
| `--router <app\|pages>` | `app` | Router flavour to scaffold for |
| `--name <name>` | `Admin` | App name written into the config |
| `--force` | off | Overwrite files that already exist |

It writes:

- `admin.config.ts` — the serializable config
- `admin.server.ts` — the server-only config, with the secret
- `middleware.ts` — the sign-in redirect
- the login route
- one page per panel

Without `--force` it refuses to overwrite anything and reports what it skipped,
so running it inside an existing project is safe.

Afterwards: set `JWT_SECRET` in `.env.local`, point the config at your real API
endpoints, and run `admin-kit docs`.

## `admin-kit docs`

```bash
npx admin-kit docs
npx admin-kit docs --out docs/admin --format md
npx admin-kit docs --config src/admin.config.ts
npx admin-kit docs --check
```

| Flag | Default | Meaning |
| --- | --- | --- |
| `--config <path>` | auto-detect | Path to the admin config |
| `--out <dir>` | `docs/admin` | Output directory |
| `--format <md\|mdx>` | `md` | Output extension |
| `--check` | off | Compare instead of writing; exit non-zero when stale |

### What it generates

| File | Content |
| --- | --- |
| `README.md` | An index, with a summary of what this install is |
| `getting-started.md` | Copy-paste snippets using your paths, your names |
| `auth.md` | Your endpoint table, session storage and its exposure, env vars |
| `access.md` | The three gates as configured, plus a role → permission matrix |
| `navigation.md` | Tiles, dock and sidebar, annotated with what each requires |
| `resources.md` | Per resource: endpoints, verbs, permissions, fields, snippets |
| `configuration.md` | Every value set and every default inherited, secrets redacted |

Generated from your config, not from a template — so it describes your
installation rather than the package. See
[`examples/app-router/docs`](../examples/app-router/docs) for real output.

### Auto-detection

With no `--config`, it looks for, in order:

```
admin.config.ts
admin.config.mts
admin.config.js
admin.config.mjs
src/admin.config.ts
app/admin.config.ts
config/admin.config.ts
```

The config must be exported as `adminConfig` or as the default export.

TypeScript is transpiled through [`jiti`](https://github.com/unjs/jiti), an
optional peer dependency — so only CLI users pay for it, and a missing install
produces a clear instruction rather than a module-resolution stack trace.

This is also why the core entry point stays free of React and DOM code: a config
that transitively imports a client component cannot be read by a CLI in plain
Node, and then no tool can generate documentation, scaffolding or checks from
it.

## `--check` in CI

Documentation that describes endpoints and permission matrices goes stale the
first time someone adds a resource. A diff that fails the build is the only
thing that reliably prevents it.

```yaml
- name: Check generated docs are current
  run: npx admin-kit docs --out docs/admin --check
```

It prints the files that would change and tells you to run `admin-kit docs` and
commit the result. This repository runs exactly that against the example app.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success, or `--check` found everything current |
| `1` | Unknown command, no command, a config that could not be loaded, or `--check` found stale files |

Errors print a message rather than a stack trace.
