'use client'

import type { ReactNode } from 'react'
import { useAuth } from '../../auth/useAuth'
import { useSidebar } from '../../navigation/useSidebar'
import { cn } from '../../utils/cn'

export interface TopbarProps {
  title?: ReactNode
  actions?: ReactNode
  className?: string
}

export function Topbar({ title, actions, className }: TopbarProps) {
  const { user, logout } = useAuth()
  const { toggle, setMobileOpen, collapsed } = useSidebar()

  return (
    <header
      className={cn(
        'admin-kit-topbar',
        'sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-neutral-200 bg-white px-4',
        className,
      )}
    >
      <button
        type="button"
        className="rounded p-1.5 text-neutral-600 hover:bg-neutral-100 md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open sidebar"
      >
        <Bars />
      </button>
      <button
        type="button"
        className="hidden rounded p-1.5 text-neutral-600 hover:bg-neutral-100 md:inline-flex"
        onClick={toggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <Bars />
      </button>
      <div className="flex-1 truncate text-sm font-medium text-neutral-800">{title}</div>
      <div className="flex items-center gap-2">{actions}</div>
      {user && (
        <div className="ml-2 flex items-center gap-2 border-l border-neutral-200 pl-3">
          <span className="text-sm text-neutral-700">{user.name ?? user.email ?? user.id}</span>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-md px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  )
}

function Bars() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}
