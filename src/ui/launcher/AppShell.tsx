'use client'

import type { ReactNode } from 'react'
import { useAdminConfig } from '../../context/AdminConfigContext'
import { useRouterBridge } from '../../context/RouterContext'
import { cn } from '../../utils/cn'
import { Brand } from '../admin/Sidebar'
import { SearchInput } from '../primitives'
import { UserMenu } from '../panels/UserMenu'
import { QuickAccessDock } from './QuickAccess'

export interface AppShellProps {
  children: ReactNode
  /** Replace the whole top bar. */
  topbar?: ReactNode
  /** Centre slot of the default top bar (a search field by default). */
  search?: ReactNode
  /** Right-hand slot. Defaults to the user menu. */
  actions?: ReactNode
  /** Footer text. Defaults to a copyright line from the app name. */
  footer?: ReactNode
  className?: string
}

/**
 * The **app panel**: the launcher.
 *
 * Where every account — administrators included — does the app's daily work.
 * The panel split is by kind of work, not by kind of account: an `isAdmin`
 * branch that swaps the entire chrome means administrators never see the
 * launcher, everyone else never sees a sidebar, and the "admin layout" is just
 * the app with different navigation.
 *
 * The layout is a flex column that owns the viewport, with `<main>` as the only
 * scrollport. That is what lets the dock stick to the bottom of the content
 * instead of the window — see the note on `.ak-dock` in `styles.css`.
 */
export function AppShell({ children, topbar, search, actions, footer, className }: AppShellProps) {
  const config = useAdminConfig()
  const { Link } = useRouterBridge()
  const panel = config.panels.app

  return (
    <div className={cn('ak-launcher', className)}>
      {topbar ?? (
        <header className="ak-launcher__topbar">
          <div className="ak-launcher__topbar-inner">
            <Link href={panel.home} className="ak-launcher__brand" aria-label="Home">
              <Brand />
            </Link>
            <div>{search ?? (panel.search ? <SearchInput placeholder="Search…" /> : null)}</div>
            <div className="ak-launcher__actions">{actions ?? <UserMenu iconOnly />}</div>
          </div>
        </header>
      )}

      <main className="ak-launcher__main">
        {/*
          A plain block, not a flex item: a page root with `margin-inline: auto`
          used directly as a flex child is sized to its content rather than
          stretched, which narrows every page to its widest table.
        */}
        <div className="ak-launcher__content">{children}</div>
        <QuickAccessDock />
      </main>

      <footer className="ak-launcher__footer">
        {footer ?? `© ${new Date().getFullYear()} ${config.app.name}`}
      </footer>
    </div>
  )
}
