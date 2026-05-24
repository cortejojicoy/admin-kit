'use client'

import { createContext, useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { NavSection } from './types'

export interface SidebarContextValue {
  sections: NavSection[]
  collapsed: boolean
  setCollapsed: (v: boolean) => void
  toggle: () => void
  mobileOpen: boolean
  setMobileOpen: (v: boolean) => void
}

export const SidebarContext = createContext<SidebarContextValue | null>(null)

export interface SidebarProviderProps {
  sections: NavSection[]
  defaultCollapsed?: boolean
  children: ReactNode
}

export function SidebarProvider({ sections, defaultCollapsed = false, children }: SidebarProviderProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const toggle = useCallback(() => setCollapsed((c) => !c), [])

  const value = useMemo<SidebarContextValue>(
    () => ({ sections, collapsed, setCollapsed, toggle, mobileOpen, setMobileOpen }),
    [sections, collapsed, mobileOpen, toggle],
  )

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}
