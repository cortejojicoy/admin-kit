import { sessionCookie } from '@cortejojicoy/admin-kit/server'
import { people } from '@/lib/db'
import { signToken } from '@/lib/jwt'

/**
 * Exchange credentials for an `HttpOnly` session cookie.
 *
 * The token is minted and set here, server side, so it never reaches client
 * JavaScript — which is what makes it survive an XSS. The client-side auth
 * provider only ever calls `/api/auth/me`.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string }

  // Demo credentials: any known email with the password "demo".
  const person = people.find((p) => p.email === body.email?.toLowerCase().trim())
  if (!person || body.password !== 'demo') {
    return Response.json({ message: 'Invalid email or password' }, { status: 401 })
  }

  const token = await signToken({
    sub: person.id,
    name: person.name,
    email: person.email,
    roles: [person.role],
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
  })

  return Response.json(
    { ok: true },
    {
      headers: {
        'Set-Cookie': sessionCookie(token, {
          name: 'northwind_session',
          maxAge: 60 * 60 * 8,
          secure: process.env.NODE_ENV === 'production',
        }),
      },
    },
  )
}
