'use client'

import { useContext } from 'react'
import { SidebarContext } from './SidebarContext'
import type { SidebarContextValue } from './SidebarContext'

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used inside <SidebarProvider>')
  return ctx
}
