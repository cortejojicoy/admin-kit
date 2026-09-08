import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AdminShell } from '@cortejojicoy/admin-kit/ui'
import {
  AccessDeniedError,
  getServerSession,
  requireAdmin,
  rolesFromSession,
} from '@cortejojicoy/admin-kit/server'
import { adminConfig } from '@/admin.config'
import { serverConfig } from '@/admin.server'

/**
 * The admin panel is gated here, once, for every route beneath it.
 *
 * This gate fails **closed**, unlike the module gates: user administration
 * decides who can access what, so a session that cannot be read must not open
 * it. Hiding the link in the user menu is not enough — the URL is still
 * reachable by typing it.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers()
  const session = await getServerSession(adminConfig, { headers: requestHeaders }, { serverConfig })
  if (!session) redirect(adminConfig.auth.loginPage?.path ?? '/login')

  try {
    await requireAdmin(adminConfig, { roles: rolesFromSession(adminConfig, session) })
  } catch (error) {
    if (error instanceof AccessDeniedError) redirect(error.redirectTo ?? '/dashboard')
    throw error
  }

  return <AdminShell>{children}</AdminShell>
}
