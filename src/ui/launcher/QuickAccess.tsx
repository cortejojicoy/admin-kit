'use client'

import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useAccess } from '../../access/AccessProvider'
import { useAdminConfig } from '../../context/AdminConfigContext'
import { isActivePath, useRouterBridge } from '../../context/RouterContext'
import { dockModules } from '../../modules/catalog'
import type { ModuleDescriptor } from '../../modules/types'
import { Icon } from '../../icons/registry'
import { cn } from '../../utils/cn'

/** Bottom-centre dock. Renders nothing when it has nothing to show. */
export function Dock({ children, className }: { children?: ReactNode; className?: string }) {
  const empty = children == null || (Array.isArray(children) && children.every((c) => c == null))
  if (empty) return null
  return (
    <div className={cn('ak-dock', className)}>{children}</div>
  )
}

export interface QuickAccessBarProps {
  modules: ModuleDescriptor[]
  /** Set when the bar is docked *inside* one of its own modules. */
  activeHref?: string
  className?: string
}

/**
 * The station modules as one inline bar.
 *
 * In a row rather than behind a menu: a short list of fixed destinations that
 * never changes is exactly the case where a dropdown costs a click and hides
 * the options for nothing. Permission-filtered upstream, so a user without one
 * of them simply has a cell fewer, and the bar disappears when none are granted.
 */
export function QuickAccessBar({ modules, activeHref, className }: QuickAccessBarProps) {
  const { Link } = useRouterBridge()
  if (modules.length === 0) return null

  return (
    <nav aria-label="Quick access" className={cn('ak-quickaccess', className)}>
      {modules.map((mod) => {
        const current = mod.href === activeHref
        return (
          <Link
            key={mod.code}
            href={mod.href}
            className="ak-quickaccess__cell"
            aria-current={current ? 'page' : undefined}
          >
            <Icon iconKey={mod.iconKey} className="ak-quickaccess__icon" />
            <span className="ak-quickaccess__label">{mod.title}</span>
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * The dock as it follows the user *into* a station module.
 *
 * The bar exists so those modules stay one click away — but a bar that only
 * lives on the home view drops the very control that got you there, and hopping
 * between two stations means going home first. Rendered from the shell, the row
 * stays on screen for the whole set with the current cell marked.
 *
 * It appears on those routes only: the launcher home carries its own dock
 * (which also holds the primary action, an operation that belongs to the
 * landing view alone), and every other page is a workspace people navigate into
 * deliberately rather than hop between.
 */
export function QuickAccessDock() {
  const config = useAdminConfig()
  const access = useAccess()
  const { pathname } = useRouterBridge()

  const modules = useMemo(
    () =>
      dockModules(config.modules, config.panels.app.dockOrder).filter((m) =>
        access.moduleVisible({ code: m.code, accessCodes: m.accessCodes, requiredLevel: m.requiredLevel }),
      ),
    [config.modules, config.panels.app.dockOrder, access],
  )

  // Matched against the *granted* cells, not a hard-coded route list: a module
  // the user cannot open is a module they cannot be standing on.
  const active = modules.find((m) => isActivePath(pathname, m.href))
  if (!active) return null

  return (
    <Dock>
      <QuickAccessBar modules={modules} activeHref={active.href} />
    </Dock>
  )
}
