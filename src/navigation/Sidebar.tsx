'use client'

import type { ComponentType, ReactNode } from 'react'
import type { LinkProps } from '../adapters/types'
import { useSidebar } from './useSidebar'
import { SidebarSection } from './SidebarSection'
import { cn } from '../utils/cn'

export interface SidebarProps {
  Link: ComponentType<LinkProps>
  currentPath: string
  header?: ReactNode
  footer?: ReactNode
  className?: string
}

export function Sidebar({ Link, currentPath, header, footer, className }: SidebarProps) {
  const { sections, collapsed, mobileOpen, setMobileOpen } = useSidebar()

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          'admin-kit-sidebar',
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-neutral-200 bg-white transition-all',
          collapsed ? 'w-16' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          className,
        )}
        aria-label="Sidebar"
      >
        {header && <div className="border-b border-neutral-200 p-3">{header}</div>}
        <nav className="flex-1 overflow-y-auto p-2">
          <div className="space-y-2">
            {sections.map((section, i) => (
              <SidebarSection
                key={section.id ?? `section-${i}`}
                section={section}
                collapsed={collapsed}
                currentPath={currentPath}
                Link={Link}
              />
            ))}
          </div>
        </nav>
        {footer && <div className="border-t border-neutral-200 p-3">{footer}</div>}
      </aside>
    </>
  )
}
