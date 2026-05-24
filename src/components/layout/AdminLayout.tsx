'use client'

import type { ComponentType, ReactNode } from 'react'
import { useMemo } from 'react'
import type { ResolvedAdminConfig } from '../../config/types'
import { useAuth } from '../../auth/useAuth'
import { useModules } from '../../modules/useModules'
import { SidebarProvider } from '../../navigation/SidebarContext'
import { Sidebar } from '../../navigation/Sidebar'
import { Topbar } from './Topbar'
import { buildNav } from '../../navigation/buildNav'
import { filterNav } from '../../navigation/filterNav'
import type { LinkProps } from '../../adapters/types'
import { cn } from '../../utils/cn'

export interface AdminLayoutProps {
  config: ResolvedAdminConfig
  /** Router-specific bits. Pass the app or pages adapter. */
  Link: ComponentType<LinkProps>
  currentPath: string
  /** Page title shown in the topbar. */
  title?: ReactNode
  /** Extra elements rendered into the topbar (right side). */
  topbarActions?: ReactNode
  children: ReactNode
  className?: string
}

export function AdminLayout({
  config,
  Link,
  currentPath,
  title,
  topbarActions,
  children,
  className,
}: AdminLayoutProps) {
  const { user } = useAuth()
  const modules = useModules()

  const sections = useMemo(
    () => filterNav(buildNav(config.navigation.sections, modules.all), user),
    [config.navigation.sections, modules, user],
  )

  const sidebarPosition = config.layout.sidebarPosition
  const Topbarish = config.layout.topbar?.component ?? Topbar
  const showTopbar = config.layout.topbar?.visible !== false

  return (
    <SidebarProvider sections={sections} defaultCollapsed={config.layout.sidebarDefaultCollapsed}>
      <div className={cn('admin-kit-root', 'min-h-screen bg-neutral-50 text-neutral-900', className)}>
        <Sidebar
          Link={Link}
          currentPath={currentPath}
          header={
            <div className="flex items-center gap-2">
              {typeof config.app.logo === 'string' ? (
                <img src={config.app.logo} alt="" className="h-6 w-6" />
              ) : (
                config.app.logo
              )}
              <span className="truncate font-semibold">{config.app.name}</span>
            </div>
          }
        />
        <div className={cn('flex min-h-screen flex-col transition-[padding]', sidebarPosition === 'right' ? 'md:pr-64' : 'md:pl-64')}>
          {showTopbar && <Topbarish title={title} actions={topbarActions} />}
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  )
}
