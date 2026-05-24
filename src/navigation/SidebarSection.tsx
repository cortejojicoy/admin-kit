'use client'

import type { ComponentType } from 'react'
import type { NavSection } from './types'
import type { LinkProps } from '../adapters/types'
import { SidebarItem } from './SidebarItem'

export interface SidebarSectionProps {
  section: NavSection
  collapsed?: boolean
  currentPath: string
  Link: ComponentType<LinkProps>
}

export function SidebarSection({ section, collapsed, currentPath, Link }: SidebarSectionProps) {
  return (
    <div className="admin-kit-nav-section">
      {section.label && !collapsed && (
        <h4 className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          {section.label}
        </h4>
      )}
      <ul className="space-y-0.5">
        {section.items.map((item, i) => (
          <SidebarItem
            key={item.id ?? item.href ?? `${item.label}-${i}`}
            item={item}
            collapsed={collapsed}
            currentPath={currentPath}
            Link={Link}
          />
        ))}
      </ul>
    </div>
  )
}
