'use client'

import { useRef } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../../auth/useAuth'
import { useAccess } from '../../access/AccessProvider'
import { useAdminConfig } from '../../context/AdminConfigContext'
import { isActivePath, useRouterBridge } from '../../context/RouterContext'
import { Icon } from '../../icons/registry'
import { cn } from '../../utils/cn'
import { useDismiss, useDisclosure } from '../hooks'
import { Button } from '../primitives'

export interface UserMenuProps {
  iconOnly?: boolean
  /** Extra items, rendered above sign out. */
  children?: ReactNode
  className?: string
}

/**
 * The account menu — and the crossing between panels.
 *
 * The panel switch lives here rather than in a floating button because a
 * floating shortcut competes with the dock and the primary action for the same
 * corner of the screen. It offers whichever panel you are *not* currently in,
 * so it never presents a link to where you already are.
 */
export function UserMenu({ iconOnly, children, className }: UserMenuProps) {
  const { user, logout } = useAuth()
  const access = useAccess()
  const config = useAdminConfig()
  const { pathname, Link, replace } = useRouterBridge()
  const menu = useDisclosure(false)
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, menu.close, menu.isOpen)

  const adminPanel = config.panels.admin
  const appPanel = config.panels.app
  const inAdmin = isActivePath(pathname, adminPanel.basePath)
  const showAdminLink = adminPanel.enabled && access.isAdmin && !inAdmin
  const showAppLink = appPanel.enabled && inAdmin

  const name = displayName(user)

  return (
    <div className={cn('ak-menu', className)} ref={ref}>
      <Button
        variant="ghost"
        iconOnly={iconOnly}
        iconKey="user"
        aria-haspopup="menu"
        aria-expanded={menu.isOpen}
        aria-label={iconOnly ? `Account: ${name}` : undefined}
        onClick={menu.toggle}
      >
        {iconOnly ? null : name}
      </Button>

      {menu.isOpen ? (
        <div className="ak-menu__panel" role="menu">
          <div className="ak-menu__header">
            <div style={{ fontWeight: 600, color: 'var(--ak-text)' }}>{name}</div>
            {user?.email ? <div>{user.email}</div> : null}
          </div>
          <div className="ak-menu__separator" />

          {children}

          {showAdminLink ? (
            <Link href={adminPanel.basePath} className="ak-menu__item" role="menuitem">
              <Icon iconKey="settings" />
              {adminPanel.title ?? 'Admin panel'}
            </Link>
          ) : null}

          {showAppLink ? (
            <Link href={adminPanel.backTo ?? appPanel.home} className="ak-menu__item" role="menuitem">
              <Icon iconKey="home" />
              Back to app
            </Link>
          ) : null}

          <div className="ak-menu__separator" />
          <button
            type="button"
            className="ak-menu__item"
            role="menuitem"
            onClick={() => {
              menu.close()
              void logout().then(() => replace(config.auth.afterLogoutRedirect))
            }}
          >
            <Icon iconKey="logout" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  )
}

function displayName(user: { name?: string; email?: string } | null): string {
  return user?.name || user?.email || 'Account'
}
