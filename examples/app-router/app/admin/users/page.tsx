import { Can } from '@cortejojicoy/admin-kit/access'
import { Button, PageHeader, ResourceTable } from '@cortejojicoy/admin-kit/ui'

/**
 * A complete CRUD list screen: the table's columns, endpoint, page size and
 * per-row permissions all come from the `users` resource in `admin.config.ts`.
 */
export default function UsersPage() {
  return (
    <>
      <PageHeader
        title="People"
        description="Accounts, roles and access."
        actions={
          // Hides the control. The route handler is what refuses the request —
          // see app/api/users/route.ts.
          <Can do="users:create">
            <Button variant="primary" iconKey="plus">
              Add person
            </Button>
          </Can>
        }
      />
      {/*
        The string form of `hrefFor`, not a callback: a function prop cannot
        cross from a server component into a client one, so `hrefFor={(row) =>
        ...}` would force this whole page to become a client component.
      */}
      <ResourceTable resource="users" hrefFor="/admin/users/:id" />
    </>
  )
}
