'use client'

import type { ReactNode } from 'react'
import { AdminProvider } from '@cortejojicoy/admin-kit/client'
import type { AccessSnapshot, AuthSession } from '@cortejojicoy/admin-kit'
import { adminConfig } from '@/admin.config'
import { icons } from '@/lib/icons'

/**
 * The client boundary.
 *
 * Icons are components, and components cannot be passed from a server component
 * to a client one — so the registry has to be *imported* on the client side
 * rather than handed across the boundary. Same for plugins and any component
 * override. This file is where that happens.
 *
 * It also imports `admin.config.ts` directly instead of receiving it as a prop,
 * which is better than it looks: the config is plain data by design, so it
 * bundles cleanly, and the secrets live in `admin.server.ts` — a separate file
 * that nothing on this side of the boundary imports.
 *
 * Only serializable values come in as props: the session and the access
 * snapshot the server already resolved.
 */
export function Providers({
  session,
  snapshot,
  children,
}: {
  session: AuthSession | null
  snapshot: AccessSnapshot
  children: ReactNode
}) {
  return (
    <AdminProvider
      config={adminConfig}
      initialSession={session}
      snapshot={snapshot}
      icons={icons}
    >
      {children}
    </AdminProvider>
  )
}
