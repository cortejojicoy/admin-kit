import { clearSessionCookie } from '@cortejojicoy/admin-kit/server'

export function POST() {
  return Response.json(
    { ok: true },
    {
      headers: {
        'Set-Cookie': clearSessionCookie({
          name: 'axiomkit_session',
          secure: process.env.NODE_ENV === 'production',
        }),
      },
    },
  )
}
