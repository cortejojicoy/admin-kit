import { createAdminMiddleware } from '@cortejojicoy/admin-kit/middleware'
import { adminConfig } from './admin.config'

/**
 * Sends signed-out browsers to the login page. A UX redirect, not the
 * authorization boundary — the gates that matter are in the layouts and route
 * handlers.
 */
export default createAdminMiddleware(adminConfig, {
  secret: process.env.JWT_SECRET ?? 'example-development-secret-not-for-production',
  algorithms: ['HS256'],
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
