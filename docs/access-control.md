# Access control

This is the part of the kit most likely to be assumed rather than read, so it is
worth being blunt up front:

**Hiding a control is not authorization, and neither is middleware.** The access
axes decide what a user *sees*. The server guards decide what a request *gets*.

## What actually gates what

| Layer | Job | Not its job |
| --- | --- | --- |
| `createAdminMiddleware` | Redirect a signed-out browser to the login page | Authorization. Next middleware has been bypassable ([CVE-2025-29927](https://nvd.nist.gov/vuln/detail/CVE-2025-29927)), and a token can be revoked after it was signed |
| `<Can>`, `<RequirePermission>` | Hide controls the user cannot use | Authorization. A hidden button is still a reachable endpoint |
| `requireModule`, `requireAdmin`, `assertPermission` | **Refuse the request** | — |

The nav filter is what makes a panel honest; a guard is what makes it a gate.

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

## The three axes

Three separate questions, configured separately, because they fail differently.

```ts
access: {
  catalog:      { endpoint: '/api/modules',        field: 'modules', fallback: STATIC_MODULES },
  entitlements: { endpoint: '/api/me/tenant',      field: 'modules', onUnavailable: 'allow' },
  permissions:  { endpoint: '/api/me/permissions', field: 'permissions', onUnavailable: 'allow' },
}
```

| Axis | Question | If the source cannot be read |
| --- | --- | --- |
| Catalog | Does the module exist and is it active? | Fall back to the declared modules, so navigation never blanks |
| Entitlement | May this tenant run it? | Fail **open** by default |
| Permission | May this user open it? | Fail **open** by default |

Failing open is deliberate. A control-plane read that failed must not be able to
put a paywall or a lockout in front of a customer who has paid. Set
`onUnavailable: 'deny'` per axis where absence genuinely means no — and note
that anything guarding administration itself (`requireAdmin`) fails closed
regardless of this setting.

Every axis is optional. With none of them configured the engine grants
everything, which is the correct behaviour for a single-tenant app with no
permission backend yet.

## Levels, not booleans

A boolean `can()` cannot express read-only access, which is the single most
common real-world requirement — "the cashier may open Billing but not post to
it". So the unit of permission is a level:

```
none  <  view  <  full
```

A boolean check is defined in terms of the level, not the other way round.
`can(code)` defaults to requiring `view`; `assertPermission()` defaults to
requiring `full`, because it guards writes.

The permissions endpoint can return whatever shape your backend already speaks —
`toAccessLevel()` normalizes a level string, a boolean, a numeric rank, or an
object with `read`/`write` flags:

| Backend sends | Becomes |
| --- | --- |
| `'full'`, `'write'`, `'edit'`, `'admin'`, `'all'` | `full` |
| `'view'`, `'read'`, `'readonly'`, `'read-only'` | `view` |
| `true` / `false` | `full` / `none` |
| `2` / `1` / `0` | `full` / `view` / `none` |
| `{ read: true }` / `{ write: true }` | `view` / `full` |
| `['users:list', 'users:create']` | every listed code at `full` |

## Roles, hierarchy and deny

Roles are only needed when your backend sends roles rather than permissions.

```ts
access: {
  roles:     { admin: ['*'], manager: ['users:*'], staff: ['users:list'] },
  hierarchy: { admin: ['manager'] },
  deny:      { manager: ['users:delete'] },
  adminRoles: ['admin'],
}
```

### Patterns

Permission patterns support `*` segments:

| Pattern | Matches | Does not match |
| --- | --- | --- |
| `*` | everything | — |
| `users:*` | `users:list`, `users:a:b` | `users` |
| `*:list` | `users:list`, `posts:list` | `users:a:list` |

A trailing `*` consumes one or more segments but never the bare code. A module
code and a permission on that module are different things, and letting one
pattern silently grant both widens roles by accident.

### Deny beats every grant

`deny` patterns are refused even when something else grants them. But the
important rule is which denials apply:

**Hierarchy accumulates grants, not restrictions.** Deny patterns come from the
roles the user is *directly assigned*, never from the roles those inherit.
Inheritance exists to accumulate capability — `admin` inheriting `manager` means
an admin can do everything a manager can. If it also inherited manager's
restrictions, then adding a line to `hierarchy` would silently take capabilities
away from the senior role. In the config above, `manager` cannot delete users;
an `admin` who merely inherits `manager` still can.

Cycles in `hierarchy` are tolerated rather than thrown on — a config typo that
makes `admin` inherit `admin` should not crash every page.

## Resolving the snapshot

Everything the engine needs is resolved once, on the server, into plain data:

```ts
import { getServerSession, resolveAccess, rolesFromSession } from '@cortejojicoy/admin-kit/server'

const session = await getServerSession(adminConfig, { headers: await headers() }, { serverConfig })
const roles = rolesFromSession(adminConfig, session)
const snapshot = await resolveAccess(adminConfig, { roles })
```

```ts
interface AccessSnapshot {
  permissions: PermissionsMap | null   // null means "could not be read" → onUnavailable
  entitlements: string[] | null        // null means unconstrained, not "entitled to nothing"
  roles: string[]
  isAdmin: boolean
}
```

The two `null`s carry meaning. `permissions: null` is what triggers
`onUnavailable`; `entitlements: null` means the tenant is unconstrained rather
than entitled to nothing — the difference between "we could not check" and
"the answer is no".

Hand the snapshot to `<AdminProvider snapshot={snapshot}>` and the first paint
already shows the right navigation, with no client fetch and no flash of items
the user cannot see.

## The engine

One pure function of `(snapshot, config)` → answers. The same engine decides
which nav entries render, which tiles the launcher shows, whether `<Can>`
renders its children, and whether a server guard redirects — so those four can
never disagree, which is the failure mode when each surface rolls its own check.

```ts
import { createAccessEngine } from '@cortejojicoy/admin-kit'

const engine = createAccessEngine(snapshot, adminConfig.access)

engine.isAdmin
engine.levelFor('users:delete')          // 'none' | 'view' | 'full'
engine.can('users:list')                 // at least 'view'
engine.can('users:delete', 'full')
engine.canAny(['users:list', 'users:read'])
engine.canAll(['users:list', 'users:read'])
engine.entitled('BILLING')               // entitlement axis only
engine.moduleVisible({ code: 'BILLING' }) // entitled AND permitted
```

## In components

```tsx
import { Can, IfAdmin, useCan, usePermissions } from '@cortejojicoy/admin-kit/access'

<Can code="users:delete" level="full">
  <DeleteButton />
</Can>

<IfAdmin>
  <a href="/admin">Administration</a>
</IfAdmin>
```

```tsx
const canDelete = useCan('users:delete', 'full')
const permissions = usePermissions()
```

These hide controls. They do not protect anything — see the table at the top.

For whole routes, `<RequireAuth>` and `<RequirePermission>` render a fallback
instead of the children, and `<AppRouterGuard>` / `<PagesRouterGuard>` redirect.
They are still client-side: use them for the experience, and a server guard for
the enforcement.

## Server guards

All of them throw `AccessDeniedError` rather than calling `redirect()`
themselves, so the same functions work in App Router server components, route
handlers, and `getServerSideProps` — each of which redirects differently.

```ts
class AccessDeniedError extends Error {
  reason: 'unauthenticated' | 'entitlement' | 'permission' | 'admin'
  code: string
  redirectTo?: string
}
```

| Guard | Checks | Fails |
| --- | --- | --- |
| `checkModule(config, code, opts)` | entitlement, then permission | returns `{ ok: false, error }` |
| `requireModule(config, code, opts)` | same, throwing | open per axis config |
| `requireEntitlement(config, code, opts)` | the tenant axis alone | open per axis config |
| `requireAdmin(config, opts)` | admin roles | **closed** |
| `assertPermission(config, code, opts)` | one code, default level `full` | open per axis config |

`checkModule` tests entitlement first and permission second because they are
different failures: a tenant that does not run a module has no such page, while
a user without permission has a page they may not see. Both end in a redirect,
but only the first should ever be described to the user as "not found".

`requireEntitlement` exists separately because an administrator's permissions
open every module by definition — a permission check on a page that *configures*
a module the install may not run would always pass, and only obscure what is
actually being enforced.

`requireAdmin` fails closed on purpose: user administration and the permission
matrix decide who can access what, so a session that cannot be read must not
open them.

```tsx
// app/admin/billing/page.tsx
import { redirect } from 'next/navigation'
import { AccessDeniedError, requireModule } from '@cortejojicoy/admin-kit/server'

export default async function Page() {
  try {
    await requireModule(adminConfig, 'BILLING', { roles })
  } catch (error) {
    if (error instanceof AccessDeniedError) redirect(error.redirectTo ?? '/dashboard')
    throw error
  }
  return <BillingScreen />
}
```

## A checklist

- [ ] Every route handler that writes calls `assertPermission()` before it writes.
- [ ] Every admin-panel layout calls `requireAdmin()` once, at the top.
- [ ] Every module page calls `requireModule()` with its code.
- [ ] `onUnavailable` is set deliberately per axis, not inherited by accident.
- [ ] `apiBaseUrl` is set in the server config, or the axes cannot resolve during SSR.
- [ ] Middleware is treated as a redirect, not a gate.

`npx admin-kit docs` writes an `access.md` describing the three gates exactly as
*you* configured them, plus a role → permission matrix. It is a faster review
than reading the config.
