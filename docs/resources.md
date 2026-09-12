# Resources & CRUD

A resource is a declaration of endpoints and fields. From it you get a table, a
form, a detail view and a set of hooks — and when the generated screens stop
fitting, you drop to the hooks and keep everything else.

Login was pluggable in 0.1.x; list, read, create, update, delete and any named
action were not. That meant the kit could authenticate against your backend and
then had nothing to say about the other 95% of it. Every operation is now an
endpoint you declare.

## A resource, end to end

```ts
resources: [
  {
    name: 'users',
    label: 'User',
    labelPlural: 'Users',
    idField: 'id',
    perPage: 25,

    endpoints: {
      list:   '/api/users',
      one:    '/api/users/:id',
      create: { method: 'POST',   path: '/api/users' },
      update: { method: 'PATCH',  path: '/api/users/:id' },
      remove: { method: 'DELETE', path: '/api/users/:id' },
      // any named extra:
      resend: { method: 'POST', path: '/api/users/:id/resend-invite' },
    },

    query: { page: 'page', perPage: 'per_page', search: 'q', sort: 'sort', order: 'order' },

    fields: [
      { name: 'id', label: 'ID', readOnly: true, sortable: true },
      { name: 'name', required: true, sortable: true },
      { name: 'email', type: 'email', required: true, sortable: true },
      { name: 'role', type: 'select', options: [
          { label: 'Admin', value: 'admin' },
          { label: 'Staff', value: 'staff' },
        ] },
      { name: 'active', type: 'boolean' },
      { name: 'notes', type: 'text', inList: false },
    ],

    permissions: {
      list: 'users:list', one: 'users:read', create: 'users:create',
      update: 'users:update', remove: 'users:delete',
    },
    writeLevel: 'full',
  },
]
```

## Endpoints

An endpoint is a string or a descriptor. `:param` segments are filled from the
call's parameters.

```ts
endpoints: {
  list: '/api/users',
  one: { method: 'GET', path: '/api/users/:id', headers: { Accept: 'application/json' } },
  archived: { method: 'GET', path: '/api/users', query: { status: 'archived' } },
}
```

| Key | Meaning |
| --- | --- |
| `method` | `GET` (default for reads), `POST`, `PUT`, `PATCH`, `DELETE` |
| `path` | Path template; `:name` segments are substituted |
| `query` | Extra query values merged into every request for this endpoint |
| `headers` | Extra headers merged into every request for this endpoint |

The five named operations are `list`, `one`, `create`, `update`, `remove`.
Anything else is a named action, reachable through `useAction()` and
`provider.invoke()`.

## Query naming

Every backend spells list parameters differently and none of them are wrong, so
the names are configuration:

```ts
query: {
  page: 'page',
  perPage: 'per_page',
  sort: 'sort',
  order: 'order',
  search: 'q',
  filterStyle: 'bracket',   // 'flat' → status=active; 'bracket' → filter[status]=active
  filterKey: 'filter',      // prefix for bracket style
  pageBase: 1,              // 1-based (default) or 0-based paging
}
```

## Mapping the wire format

`map` holds the only functions a resource may carry. `serializeConfig()` strips
them at the RSC boundary and the client re-attaches them from its own import, so
the config still crosses.

```ts
map: {
  list: (raw) => ({ rows: raw.data, total: raw.meta.total }),
  one: (raw) => raw.data,
  toWire: (input, op) => (op === 'create' ? { ...input, source: 'admin' } : input),
  error: (raw, status) => ({
    message: raw.message ?? 'Request failed',
    status,
    fields: raw.errors,       // { email: 'already taken' }
  }),
}
```

`map.error` is worth setting. Field-level messages are mapped back onto the
inputs that caused them, because a validation failure rendered as one banner at
the top of a twelve-field form makes the user hunt for their own mistake.

## Fields

Field descriptors drive the generated table, form and detail view.

```ts
{
  name: 'email',
  label: 'Email address',
  type: 'email',
  required: true,
  readOnly: false,
  inList: true,        // show in the table; default: true for the first 6 fields
  inForm: true,        // show in the form; default: true unless readOnly
  sortable: true,
  placeholder: 'name@example.com',
  help: 'Used for sign-in.',
}
```

Types: `string`, `text`, `number`, `boolean`, `date`, `datetime`, `email`,
`select` (with `options`), `reference` (with `reference: 'otherResource'`),
`json`.

## Permissions

```ts
permissions: { list: 'users:list', remove: 'users:delete' },
writeLevel: 'full',
```

The hooks check these before issuing the request: a table the user may not read
should not fire the call that will 403. `writeLevel` is the minimum level
required for write operations, defaulting to `full` — see
[Access control](./access-control.md) for what levels mean.

This is still client-side. The endpoint behind the button is what needs
guarding; put `assertPermission()` at the top of the route handler.

## Generated screens

```tsx
import { PageHeader, ResourceTable, ResourceForm, ResourceShow } from '@cortejojicoy/admin-kit/ui'

<ResourceTable
  resource="users"
  hrefFor="/admin/users/:id"          // string form is serializable
  searchable
  actions={<Button>Invite</Button>}
  rowActions={(row) => <ResendButton id={row.id} />}
/>

<ResourceForm resource="users" id={params.id} onSaved={() => router.push('/admin/users')} />

<ResourceShow resource="users" id={params.id} />
```

Prefer the string form of `hrefFor` — it is serializable, so the page rendering
the table can stay a server component. The function form is available from
client pages.

Columns, endpoint, page size, sorting, search, pagination and the delete
button's permission all come from the resource definition. Anything the
generated screens cannot express is a reason to write that screen by hand and
keep the hooks — not a reason for a dozen more props.

## Hooks

```tsx
'use client'
import { useList, useOne, useCreate, useUpdate, useDelete, useAction } from '@cortejojicoy/admin-kit/data'

const { rows, total, loading, validating, error, allowed, page, perPage, pageCount, setPage, refetch } =
  useList<User>('users', { page: 1, perPage: 25, search: term, sort: 'name', order: 'asc', filter: { active: true } })

const { data, loading, error, allowed } = useOne<User>('users', id)

const create = useCreate<User>('users')
const update = useUpdate<User>('users')
const remove = useDelete('users')
const resend = useAction('users', 'resend')

await create.mutate({ name: 'Ada', email: 'ada@example.com' })
await update.mutate({ id, data: { active: false } })
await remove.mutate({ id })
await resend.mutate({ id })
```

`validating` is true while a refetch is in flight and the previous data is still
on screen, which is what you want for a search box: the table stays readable
instead of flashing a skeleton on every keystroke. `allowed` is false when the
user lacks the resource's read permission, so a screen can say so rather than
render an empty table.

`useList` accepts `enabled: false` to skip fetching while a dependency is still
unknown.

## The data provider

The hooks talk to a `DataProvider`. The default is REST:

```ts
import { createRestDataProvider } from '@cortejojicoy/admin-kit/data'

const provider = createRestDataProvider({ resources: adminConfig.resources, baseUrl: '/api' })
```

Swap it for anything implementing the interface — GraphQL, an SDK, a mock in
tests:

```ts
interface DataProvider {
  getList(resource, params?): Promise<{ rows, total }>
  getOne(resource, { id, signal? }): Promise<T>
  getMany(resource, { ids, signal? }): Promise<T[]>
  create(resource, { data }): Promise<T>
  update(resource, { id, data, previous? }): Promise<T>
  remove(resource, { id }): Promise<void>
  invoke(resource, action, params?): Promise<T>
}
```

```tsx
<AdminProvider config={adminConfig} dataProvider={myProvider}>
```

`buildListQuery()` and `fillPath()` are exported if you are building a provider
and want the same parameter serialization the REST one uses.

## Caching

`DataStore` is a small cache keyed by resource and parameters. Mutations
invalidate the affected resource's prefix, so a create refreshes the list it
belongs to without you wiring it. `cacheKey()` and `resourcePrefix()` are
exported for manual invalidation.

## Type checking a resource

```ts
import { defineResource } from '@cortejojicoy/admin-kit/data'

export const users = defineResource({
  name: 'users',
  endpoints: { list: '/api/users' },
})
```

An identity function, for the inference.

## Documenting your resources

`npx admin-kit docs` writes a `resources.md` describing every endpoint, verb,
permission and field you declared, with usage snippets that name *your*
resources. See [CLI](./cli.md).
