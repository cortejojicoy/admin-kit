'use client'

import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useAccess } from '../../access/AccessProvider'
import { useAdminConfig } from '../../context/AdminConfigContext'
import { useRouterBridge } from '../../context/RouterContext'
import { buildNav } from '../../navigation/buildNav'
import { filterNav } from '../../navigation/filterNav'
import { usePlugins } from '../../modules/PluginContext'
import { Icon } from '../../icons/registry'
import { cn } from '../../utils/cn'
import { useDisclosure, useLocalStorage, useMediaQuery, useSlideTransition } from '../hooks'
import { Button } from '../primitives'
import { UserMenu } from '../panels/UserMenu'
import { Sidebar } from './Sidebar'
import { SidebarNav } from './SidebarNav'

/** Must match the CSS transition duration in `styles.css`. */
const DRAWER_MS = 300

export interface AdminShellProps {
  children: ReactNode
  /** Replace the sidebar entirely. */
  sidebar?: ReactNode
  /** Topbar slots. */
  topbar?: { title?: ReactNode; actions?: ReactNode; children?: ReactNode }
  className?: string
}

/**
 * The **admin panel**: sidebar plus top bar.
 *
 * A permanent rail on wide screens, a slide-in drawer with an overlay below the
 * breakpoint, and a collapsed state that persists. Everything it needs — config,
 * router, access — comes from context, so mounting it is `<AdminShell>{children}
 * </AdminShell>` and nothing else. (v0.1.x required `config`, `Link` and
 * `currentPath` to be threaded in by hand.)
 *
 * The top bar deliberately has no search slot: search in this kit looks up
 * records, which is app-panel work and means nothing against a configuration
 * page. Pass one through `topbar.children` if your admin panel genuinely has
 * something to search.
 */
export function AdminShell({ children, sidebar, topbar, className }: AdminShellProps) {
  const config = useAdminConfig()
  const access = useAccess()
  const plugins = usePlugins()
  const { Link } = useRouterBridge()

  const drawer = useDisclosure(false)
  const [collapsed, setCollapsed] = useLocalStorage('ak-sidebar-collapsed', config.layout.sidebarDefaultCollapsed)
  const isDesktop = useMediaQuery('(min-width: 64rem)')

  // Crossing into the desktop breakpoint with the drawer open would leave an
  // invisible overlay swallowing clicks.
  useEffect(() => {
    if (isDesktop) drawer.close()
  }, [isDesktop, drawer])

  const { mounted, shown } = useSlideTransition(!isDesktop && drawer.isOpen, DRAWER_MS)

  const sections = useMemo(() => {
    const built = buildNav({
      sections: config.panels.admin.sections ?? config.navigation.sections,
      plugins: plugins.all,
    })
    return filterNav(built, access)
  }, [config.panels.admin.sections, config.navigation.sections, plugins, access])

  const rail = (isCollapsed: boolean) =>
    sidebar ?? (
      <Sidebar
        collapsed={isCollapsed}
        footer={
          <Link href={config.panels.admin.backTo ?? config.panels.app.home} className="ak-navitem">
            <Icon iconKey="chevronLeft" className="ak-navitem__icon" />
            {!isCollapsed ? <span className="ak-navitem__label">Back to app</span> : null}
          </Link>
        }
      >
        <SidebarNav sections={sections} collapsed={isCollapsed} />
      </Sidebar>
    )

  return (
    <div className={cn('ak-shell', className)}>
      <div className="ak-desktop-only">{rail(collapsed)}</div>

      {mounted ? (
        <div className="ak-drawer ak-mobile-only" data-shown={shown}>
          <button
            type="button"
            className="ak-drawer__overlay"
            aria-label="Close navigation menu"
            onClick={drawer.close}
          />
          <div className="ak-drawer__panel">{rail(false)}</div>
        </div>
      ) : null}

      <div className="ak-shell__body">
        <header className="ak-topbar">
          <Button
            className="ak-mobile-only"
            variant="ghost"
            iconOnly
            iconKey="menu"
            aria-label="Open navigation menu"
            onClick={drawer.toggle}
          />
          {config.layout.sidebarCollapsible ? (
            <Button
              className="ak-desktop-only"
              variant="ghost"
              iconOnly
              iconKey={collapsed ? 'chevronRight' : 'chevronLeft'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setCollapsed((v) => !v)}
            />
          ) : null}

          {topbar?.children ?? (
            <span className="ak-topbar__title">
              {topbar?.title ?? config.panels.admin.title ?? 'Admin'}
            </span>
          )}
          <span className="ak-topbar__spacer" />
          <div className="ak-topbar__actions">{topbar?.actions ?? <UserMenu />}</div>
        </header>

        <main className="ak-shell__main">
          <div className="ak-container">{children}</div>
        </main>
      </div>
    </div>
  )
}
