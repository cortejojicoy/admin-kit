'use client'

import { useContext } from 'react'
import { ModuleContext } from './ModuleContext'
import type { ModuleRegistry } from './registry'

export function useModules(): ModuleRegistry {
  const ctx = useContext(ModuleContext)
  if (!ctx) throw new Error('useModules must be used inside <AdminProvider> / <ModuleProvider>')
  return ctx
}
