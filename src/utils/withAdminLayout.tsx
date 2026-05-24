/**
 * Pages-router compatibility HOC. Wraps a page component in AdminLayout
 * using the pages-router adapter. For App Router, use `<AdminLayout>` inside
 * `app/(admin)/layout.tsx` directly.
 *
 * Usage (pages/):
 *   import { withAdminLayout } from '@kukux/admin-kit'
 *   function DashboardPage() { ... }
 *   export default withAdminLayout(DashboardPage, { title: 'Dashboard' })
 */
'use client'

import type { ComponentType, ReactNode } from 'react'
import type { ResolvedAdminConfig } from '../config/types'
import { AdminLayout } from '../components/layout/AdminLayout'
import { PagesLink, usePagesPathname } from '../adapters/pagesRoute'

export interface WithAdminLayoutOptions {
  config: ResolvedAdminConfig
  title?: ReactNode
  topbarActions?: ReactNode
}

export function withAdminLayout<P extends object>(
  Page: ComponentType<P>,
  opts: WithAdminLayoutOptions,
): ComponentType<P> {
  function Wrapped(props: P) {
    const currentPath = usePagesPathname()
    return (
      <AdminLayout
        config={opts.config}
        Link={PagesLink}
        currentPath={currentPath}
        title={opts.title}
        topbarActions={opts.topbarActions}
      >
        <Page {...props} />
      </AdminLayout>
    )
  }
  Wrapped.displayName = `withAdminLayout(${Page.displayName ?? Page.name ?? 'Page'})`
  return Wrapped
}
