'use client'

import { useState } from 'react'
import type { NavItem, NavSection } from '../../navigation/types'
import { isActivePath, useRouterBridge } from '../../context/RouterContext'
import { Icon } from '../../icons/registry'
import { cn } from '../../utils/cn'

export interface SidebarNavProps {
  sections: NavSection[]
  collapsed?: boolean
  className?: string
}

/**
 * Renders an already-filtered nav tree.
 *
 * Filtering is *not* done here — it happens once, through the access engine,
 * before the tree reaches any renderer. A component that both renders and
 * decides visibility is how a sidebar ends up disagreeing with a page guard.
 */
export function SidebarNav({ sections, collapsed, className }: SidebarNavProps) {
  return (
    <div className={cn(className)}>
      {sections.map((section, index) => (
        <div className="ak-navsection" key={section.id ?? index}>
          {section.label && !collapsed ? (
            <div className="ak-navsection__label">{section.label}</div>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
            {section.items.map((item, i) => (
              <SidebarItem key={item.id ?? item.href ?? i} item={item} collapsed={collapsed} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function SidebarItem({ item, collapsed, depth = 0 }: { item: NavItem; collapsed?: boolean; depth?: number }) {
  const { pathname, Link } = useRouterBridge()
  const hasChildren = Boolean(item.children?.length)

  const selfActive = isActivePath(pathname, item.href)
  const childActive = hasChildren && item.children!.some((c) => isActivePath(pathname, c.href))

  // A group containing the current route starts open. Tracked as state rather
  // than derived, so opening a different group doesn't snap shut on navigation.
  const [open, setOpen] = useState(childActive)

  const content = (
    <>
      {item.iconKey ? <Icon iconKey={item.iconKey} className="ak-navitem__icon" /> : null}
      {!collapsed ? <span className="ak-navitem__label">{item.label}</span> : null}
      {!collapsed && item.badge != null ? <span className="ak-badge">{item.badge}</span> : null}
      {!collapsed && hasChildren ? (
        <Icon iconKey="chevronDown" className="ak-navitem__chevron" />
      ) : null}
    </>
  )

  if (hasChildren && !item.href) {
    return (
      <>
        <button
          type="button"
          className="ak-navitem"
          aria-expanded={open}
          data-active={childActive || undefined}
          onClick={() => setOpen((v) => !v)}
          title={collapsed ? item.label : undefined}
        >
          {content}
        </button>
        {open && !collapsed ? (
          <div className="ak-navchildren">
            {item.children!.map((child, i) => (
              <SidebarItem key={child.id ?? child.href ?? i} item={child} depth={depth + 1} />
            ))}
          </div>
        ) : null}
      </>
    )
  }

  const link = item.external ? (
    <a
      href={item.href}
      className="ak-navitem"
      target="_blank"
      rel="noreferrer noopener"
      title={collapsed ? item.label : undefined}
    >
      {content}
    </a>
  ) : (
    <Link
      href={item.href ?? '#'}
      className="ak-navitem"
      aria-current={selfActive ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
    >
      {content}
    </Link>
  )

  if (!hasChildren) return link

  return (
    <>
      {link}
      {!collapsed ? (
        <div className="ak-navchildren">
          {item.children!.map((child, i) => (
            <SidebarItem key={child.id ?? child.href ?? i} item={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </>
  )
}
