# Versioning & releases

Git tags are the source of truth. `package.json`'s `version` is a derived
artifact, written from the tag at release time — so a published version always
has a tag pointing at the exact commit it was built from.

This page is for people working on the kit itself. If you are only consuming it,
the part worth knowing is the [stage progression](#the-stage-progression): a
pre-release publishes under its own npm dist-tag, so `npm install` keeps serving
`latest`.

## The scheme

```
vMAJOR.MINOR.PATCH[-stage.N]        alpha | beta | rc | lts
```

`tool/version.py` owns it, adapted from the same tool in `trackbnb-flutter`.

```bash
pnpm version:current     # the version implied by the tags
pnpm version:next        # what the next release would be
```

## Cutting a release

From a clean `main`:

```bash
./tool/release.sh minor              # 0.1.8 → v0.2.0
./tool/release.sh beta               # open a public-testing cycle
./tool/release.sh promote            # turn the current pre-release stable
./tool/release.sh patch --dry-run    # show everything, change nothing
```

It refuses to run from a dirty tree, from a branch other than `main`, or from a
`main` behind origin. Then it runs `pnpm verify`, promotes the CHANGELOG's
`## [Unreleased]` section, writes the version into `package.json`, commits, tags
that commit, and pushes. CI publishes from the tag.

## The stage progression

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

Pre-releases publish under their own npm dist-tag:

```bash
npm install @cortejojicoy/admin-kit          # latest stable
npm install @cortejojicoy/admin-kit@beta     # current public-testing build
```

## The publish gate

```bash
pnpm verify
```

That is `typecheck + lint + test + test:tool + build + smoke + publint + attw`,
and `tool/release.sh` runs it before it will tag anything. In order:

| Step | What it catches |
| --- | --- |
| `typecheck` | Source and tests, separately configured |
| `lint` | `eslint src tests scripts` |
| `test` | Vitest |
| `test:tool` | The release tooling's own Python tests |
| `build` | `tsup` plus the stylesheet copy |
| `smoke` | Loads every entry point in ESM and CJS, and asserts the `"use client"` directives landed where they belong |
| `check:package` | `publint --strict` and `are-the-types-wrong` against the packed tarball |

The smoke test earns its place: 0.1.8 shipped an exports map pointing at files
`tsup` never emitted, and a client bundle with its directive stripped in
bundling. Both typechecked cleanly.

CI additionally builds `examples/app-router` against the packaged output. A Next
build against the real package is the only thing that catches duplicated React
contexts across entry points, a JSX runtime mismatch, or an edge-runtime API the
bundle cannot actually call.

## Why there is no auto-bump job

A job that bumps `package.json` on every push cannot coexist with tag-driven
versioning: the tool computes a version from the tags, and the bump job would
immediately disagree with it. It is also how `v0.1.8` reached the registry with
no tag pointing at it.

## Trusted publishing

CI publishes with npm's OIDC trusted publishing and provenance — there is no
`NPM_TOKEN`. Two details are worth recording, because both fail in misleading
ways:

- The workflow deliberately does **not** set `registry-url` on
  `actions/setup-node`. Doing so writes an `.npmrc` with a placeholder auth
  token, npm then takes the classic-token path and never attempts the OIDC
  handshake, and the registry treats the publish as anonymous. An unauthorised
  write to an existing package returns **404**, not 403 — so the failure reads
  like a missing package rather than an auth problem.
- Trusted publishing needs npm ≥ 11.5.1, which is newer than the runner's
  bundled npm. The workflow upgrades it and asserts the version in a preflight
  step, so the next failure is legible.

## Changelog

`CHANGELOG.md` is kept by hand under a `## [Unreleased]` heading;
`tool/release.sh` promotes that section into the new version's heading, and the
GitHub release notes come from it (falling back to the commit log between tags).
