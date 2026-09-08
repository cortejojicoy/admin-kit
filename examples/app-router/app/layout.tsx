import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import { getServerSession, resolveAccess, rolesFromSession } from '@cortejojicoy/admin-kit/server'
import { adminConfig } from '@/admin.config'
import { serverConfig } from '@/admin.server'
import { Providers } from './providers'
import '@cortejojicoy/admin-kit/styles.css'
import './globals.css'

export const metadata = {
  title: 'Northwind',
  description: 'admin-kit example — App Router',
}

/**
 * Session and access are resolved here, on the server, and passed down as data.
 *
 * That is what keeping the config serializable buys: the first paint already
 * has the right navigation for the right user, with no client fetch and no
 * flash of items they cannot see.
 *
 * Components — icons, plugins, overrides — cannot cross this boundary, so they
 * are registered inside `<Providers>`, which is a client module.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers()
  const session = await getServerSession(adminConfig, { headers: requestHeaders }, { serverConfig })
  const roles = rolesFromSession(adminConfig, session)
  const snapshot = await resolveAccess(adminConfig, { roles })

  return (
    <html lang="en">
      <body>
        <Providers session={session} snapshot={snapshot}>
          {children}
        </Providers>
      </body>
    </html>
  )
}
