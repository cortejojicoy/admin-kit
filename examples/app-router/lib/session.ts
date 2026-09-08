import { headers } from 'next/headers'
import { getServerSession, rolesFromSession } from '@cortejojicoy/admin-kit/server'
import { adminConfig } from '@/admin.config'
import { serverConfig } from '@/admin.server'

/**
 * Read the session inside a route handler.
 *
 * Route handlers do the authorizing in this app. Middleware only redirects
 * browsers, and `<Can>` only hides controls — neither one refuses a request.
 */
export async function currentSession() {
  const requestHeaders = await headers()
  const session = await getServerSession(
    adminConfig,
    { headers: requestHeaders },
    { serverConfig },
  )
  return { session, roles: rolesFromSession(adminConfig, session) }
}
