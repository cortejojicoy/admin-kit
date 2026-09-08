import { AccessDeniedError, assertPermission } from '@cortejojicoy/admin-kit/server'
import { adminConfig } from '@/admin.config'
import { createPerson, people } from '@/lib/db'
import { currentSession } from '@/lib/session'

/**
 * The list and create endpoints for the `users` resource.
 *
 * `assertPermission` is the actual gate. The `<Can>` around the "Add person"
 * button hides a control; this refuses the request — which is the difference
 * between an honest UI and a secure one.
 */
export async function GET(request: Request) {
  const { session, roles } = await currentSession()
  if (!session) return unauthorized()

  try {
    await assertPermission(adminConfig, 'users:list', { roles, level: 'view' })
  } catch (error) {
    return forbidden(error)
  }

  const url = new URL(request.url)
  const query = (url.searchParams.get('q') ?? '').toLowerCase()
  const page = Number(url.searchParams.get('page') ?? '1')
  const perPage = Number(url.searchParams.get('per_page') ?? '25')

  const matched = query
    ? people.filter(
        (p) => p.name.toLowerCase().includes(query) || p.email.toLowerCase().includes(query),
      )
    : people

  const start = (page - 1) * perPage
  return Response.json({
    data: matched.slice(start, start + perPage),
    meta: { total: matched.length },
  })
}

export async function POST(request: Request) {
  const { session, roles } = await currentSession()
  if (!session) return unauthorized()

  try {
    await assertPermission(adminConfig, 'users:create', { roles })
  } catch (error) {
    return forbidden(error)
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  if (!body.email) {
    // The shape `map.error` and the generated form expect for field errors.
    return Response.json(
      { message: 'Validation failed', errors: { email: ['Email is required'] } },
      { status: 422 },
    )
  }

  return Response.json({ data: createPerson(body) }, { status: 201 })
}

function unauthorized() {
  return Response.json({ message: 'Not signed in' }, { status: 401 })
}

function forbidden(error: unknown) {
  if (error instanceof AccessDeniedError) {
    return Response.json({ message: error.message }, { status: 403 })
  }
  throw error
}
