'use client'

import { useState } from 'react'
import type { ComponentType } from 'react'
import type { NavItem } from './types'
import type { LinkProps } from '../adapters/types'
import { cn } from '../utils/cn'

export interface SidebarItemProps {
  item: NavItem
  active?: boolean
  collapsed?: boolean
  Link: ComponentType<LinkProps>
  currentPath: string
  depth?: number
}

export function SidebarItem({ item, collapsed, Link, currentPath, depth = 0 }: SidebarItemProps) {
  const hasChildren = (item.children?.length ?? 0) > 0
  const isActive =
    item.href != null && (currentPath === item.href || currentPath.startsWith(item.href + '/'))
  const [open, setOpen] = useState(isActive)

  const baseCls = cn(
    'admin-kit-nav-item',
    'group flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
    depth > 0 && 'ml-3',
  )

  if (hasChildren) {
    return (
      <li>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(baseCls, 'w-full justify-between')}
          aria-expanded={open}
        >
          <span className="flex items-center gap-2 min-w-0">
            {item.icon}
            {!collapsed && <span className="truncate">{item.label}</span>}
          </span>
          {!collapsed && (
            <span aria-hidden className={cn('text-xs transition-transform', open && 'rotate-90')}>
              ›
            </span>
          )}
        </button>
        {open && !collapsed && (
          <ul className="mt-1 space-y-0.5 border-l border-neutral-200 pl-2">
            {item.children!.map((child, i) => (
              <SidebarItem
                key={child.id ?? child.href ?? `${child.label}-${i}`}
                item={child}
                Link={Link}
                currentPath={currentPath}
                depth={depth + 1}
              />
            ))}
          </ul>
        )}
      </li>
    )
  }

  if (!item.href) {
    return (
      <li>
        <span className={baseCls}>
          {item.icon}
          {!collapsed && <span className="truncate">{item.label}</span>}
        </span>
      </li>
    )
  }

  return (
    <li>
      <Link
        href={item.href}
        className={baseCls}
        {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {item.icon}
        {!collapsed && (
          <>
            <span className="truncate flex-1">{item.label}</span>
            {item.badge != null && (
              <span className="ml-auto inline-flex items-center rounded-full bg-neutral-200 px-2 text-xs font-medium text-neutral-700">
                {item.badge}
              </span>
            )}
          </>
        )}
      </Link>
    </li>
  )
}
