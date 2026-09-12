# Live demo

Axiomkit is a complete admin-kit installation you can sign into. Three people
sign into the **same** application and get three different ones — different
tiles, different controls, different answers from the API.

None of that is special-cased in the demo's code. It all falls out of the
[configuration](./configuration.md), which is the thing worth watching.

## Sign in

The password for every account is `demo`.

| Email | Role | In one line |
| --- | --- | --- |
| `ada@axiomkit.test` | admin | Everything, including the admin panel |
| `blaise@axiomkit.test` | manager | Can edit people, cannot delete them |
| `chen@axiomkit.test` | staff | Read-only |

Start as Ada to see the whole installation, then sign out and come back as
Blaise. Same app, fewer of it.

## Ada — the whole installation

She lands on `/dashboard`, the **launcher**. Four tiles — People taking the wide
cell, Alerts the highlighted one beside it, then Orders and Reports — over a
dock holding Inbox and Lookup. Tiles are the modules you run your shift from;
the dock holds stations you step into and back out of.

`/admin` opens the **admin panel**, the sidebar layout, and `/admin/users` is
the People screen. That screen is not hand-written:

```tsx
<ResourceTable resource="users" hrefFor="/admin/users/:id" />
```

Its columns, sorting, search, pagination and delete button all come from the
`users` resource definition. Clicking a row opens a detail view and an edit
form, both generated the same way. Ada's delete works — the row goes.

## Blaise — the same app, minus what he cannot do

The launcher now shows **three** tiles. Alerts is gone and the dock is empty,
because `manager` holds no grant matching `ALERTS`, `INBOX` or `SEARCH`.

The filtering happens on the server, before the page is sent, so this is what
the first paint looks like — there is no moment where Blaise sees a tile appear
and then vanish.

Two refusals are worth triggering:

- **The admin panel.** Navigating to `/admin` puts him back on `/dashboard`.
  The panel is gated as a whole by `requireAdmin`, and `manager` is not in
  `adminRoles`.
- **Deleting a person.** `deny: { manager: ['users:delete'] }` beats his
  `users:*` grant, so the control is hidden *and* the endpoint refuses.
  Editing still works.

## Chen — read-only

One tile: Orders. He can read the people list but not change it — every write
comes back refused, and `/admin` redirects like it does for Blaise.

## What each difference is showing you

| What you see | What is doing it |
| --- | --- |
| Blaise has fewer tiles than Ada | Permission axis, filtering modules by code |
| No flash of tiles that then disappear | Access resolved on the server, handed to the client as data |
| Blaise can edit but not delete | `deny` beats every grant, including a wildcard one |
| Ada can delete, though `admin` inherits `manager`'s denial | Hierarchy accumulates grants, never restrictions |
| `/admin` bounces both non-admins | `requireAdmin`, which fails **closed** |
| The API refuses even without the button | `assertPermission()` in the route handler |

## The gate is the endpoint, not the button

This is the part worth taking away, and you can check it without the UI. Sign in
as Blaise and call the endpoint directly — the delete button being hidden is not
what stops him:

```bash
curl -c jar -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"blaise@axiomkit.test","password":"demo"}'

curl -b jar -X PATCH  http://localhost:3000/api/users/1 \
  -H 'content-type: application/json' -d '{"name":"Ada O."}'   # 200
curl -b jar -X DELETE http://localhost:3000/api/users/4        # 403
```

Every account, measured against the running demo:

| Account | `GET /api/users` | `PATCH /api/users/1` | `DELETE /api/users/4` | `/admin` |
| --- | --- | --- | --- | --- |
| Ada (admin) | 200 | 200 | 204 | 200 |
| Blaise (manager) | 200 | 200 | **403** | 307 → `/dashboard` |
| Chen (staff) | 200 | **403** | **403** | 307 → `/dashboard` |

A hidden button is a courtesy. The 403 is the authorization. See
[Access control](./access-control.md) for why the two are separate layers.

## What the demo is not

Worth knowing before you go clicking:

- **Only People is built.** Alerts, Orders, Reports, Inbox and Lookup are
  declared modules with no pages behind them. They are there to show navigation
  being filtered per role; opening one gives you a 404.
- **Blaise sees the People tile but cannot open it.** It points at
  `/admin/users`, inside the admin-only panel. A real install would point
  non-admins at a screen they can actually reach — the demo leaves it as-is
  because the redirect is itself worth seeing.
- **The data lives in memory.** Deleting someone is real until the server
  restarts, and then everyone is back. There is no database to provision and
  nothing to clean up after you.

## Running it yourself

The demo is [`examples/app-router`](../examples/app-router) in the repository:

```bash
pnpm install
pnpm build                                 # the example imports the built kit
pnpm --filter @examples/app-router dev
```

It is built in CI against the packaged output, which is what catches the class
of bug that typechecks cleanly and ships broken.
