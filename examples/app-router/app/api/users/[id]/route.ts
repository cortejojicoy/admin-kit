import { AccessDeniedError, assertPermission } from '@cortejojicoy/admin-kit/server'
import { adminConfig } from '@/admin.config'
import { people, type Person } from '@/lib/db'
import { currentSession } from '@/lib/session'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const guard = await guarded('users:read', 'view')
  if (guard) return guard

  const person = people.find((p) => p.id === id)
  if (!person) return Response.json({ message: 'Not found' }, { status: 404 })
  return Response.json({ data: person })
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const guard = await guarded('users:update', 'full')
  if (guard) return guard

  const index = people.findIndex((p) => p.id === id)
  if (index === -1) return Response.json({ message: 'Not found' }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as Partial<Person>
  people[index] = { ...people[index], ...body, id }
  return Response.json({ data: people[index] })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  // Note that `manager` is denied this one explicitly in the config's `deny`
  // block, even though `users:*` would otherwise grant it.
  const guard = await guarded('users:delete', 'full')
  if (guard) return guard

  const index = people.findIndex((p) => p.id === id)
  if (index === -1) return Response.json({ message: 'Not found' }, { status: 404 })
  people.splice(index, 1)
  return new Response(null, { status: 204 })
}

/** Returns a response when the request should be refused, otherwise nothing. */
async function guarded(code: string, level: 'view' | 'full'): Promise<Response | null> {
  const { session, roles } = await currentSession()
  if (!session) return Response.json({ message: 'Not signed in' }, { status: 401 })
  try {
    await assertPermission(adminConfig, code, { roles, level })
    return null
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return Response.json({ message: error.message }, { status: 403 })
    }
    throw error
  }
}
