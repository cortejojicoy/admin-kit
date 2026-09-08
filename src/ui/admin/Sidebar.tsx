'use client'

import type { ReactNode } from 'react'
import { useAdminConfig } from '../../context/AdminConfigContext'
import { useRouterBridge } from '../../context/RouterContext'
import { Icon } from '../../icons/registry'
import type { NavSection } from '../../navigation/types'
import { cn } from '../../utils/cn'
import { SidebarNav } from './SidebarNav'

export interface SidebarProps {
  sections?: NavSection[]
  /** Replaces the nav entirely. */
  children?: ReactNode
  /** Brand slot. Defaults to the configured app name and logo. */
  header?: ReactNode
  /** Pinned to the bottom — where "back to app" lives. */
  footer?: ReactNode
  collapsed?: boolean
  className?: string
}

export function Sidebar({ sections, children, header, footer, collapsed = false, className }: SidebarProps) {
  const config = useAdminConfig()
  const { Link } = useRouterBridge()

  const brand =
    header ?? (
      <Link href={config.panels.admin.basePath} className="ak-launcher__brand">
        <Brand />
      </Link>
    )

  return (
    <aside
      className={cn('ak-sidebar', className)}
      data-collapsed={collapsed}
      data-position={config.layout.sidebarPosition}
    >
      <div className="ak-sidebar__header">{brand}</div>
      <nav className="ak-sidebar__nav" aria-label="Sidebar">
        {children ?? <SidebarNav sections={sections ?? []} collapsed={collapsed} />}
      </nav>
      {footer ? <div className="ak-sidebar__footer">{footer}</div> : null}
    </aside>
  )
}

/** The app's mark and name, from config. */
export function Brand({ showName = true }: { showName?: boolean }) {
  const config = useAdminConfig()
  return (
    <>
      {config.app.logoUrl ? (
        <img src={config.app.logoUrl} alt="" width={22} height={22} />
      ) : (
        <Icon iconKey={config.app.logoIconKey ?? 'grid'} style={{ width: '1.375rem', height: '1.375rem' }} />
      )}
      {showName ? <span className="ak-navitem__label">{config.app.name}</span> : null}
    </>
  )
}
