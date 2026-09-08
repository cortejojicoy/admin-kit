import { currentSession } from '@/lib/session'

/** The endpoint the client auth provider polls to hydrate the session. */
export async function GET() {
  const { session } = await currentSession()
  if (!session) return Response.json({ message: 'Not signed in' }, { status: 401 })

  return Response.json({
    id: session.user.sub,
    name: session.user.name,
    email: session.user.email,
    roles: session.user.roles,
  })
}
