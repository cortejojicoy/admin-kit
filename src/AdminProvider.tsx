'use client'

import { useMemo } from 'react'
import type { ReactNode } from 'react'
import type { AdminConfig } from './config/types'
import { resolveConfig } from './config/defaults'
import { AuthContextProvider } from './auth/AuthContext'
import { ModuleProvider } from './modules/ModuleContext'
import { ThemeProvider } from './theme/ThemeProvider'
import { useAuth } from './auth/useAuth'
import type { AuthSession } from './auth/types'

export interface AdminProviderProps {
  config: AdminConfig
  initialSession?: AuthSession | null
  children: ReactNode
}

/**
 * Top-level provider. Wraps everything in:
 *   ThemeProvider → AuthContextProvider → ModuleProvider → children
 *
 * The user prop is read from auth context inside ModuleBridge so modules
 * can apply `enabled({ user })` predicates without prop drilling.
 */
export function AdminProvider({ config, initialSession, children }: AdminProviderProps) {
  const resolved = useMemo(() => resolveConfig(config), [config])

  return (
    <ThemeProvider theme={resolved.theme}>
      <AuthContextProvider config={resolved.auth} initialSession={initialSession}>
        <ModuleBridge modules={resolved.modules ?? []}>{children}</ModuleBridge>
      </AuthContextProvider>
    </ThemeProvider>
  )
}

function ModuleBridge({
  modules,
  children,
}: {
  modules: NonNullable<AdminConfig['modules']>
  children: ReactNode
}) {
  const { user } = useAuth()
  return (
    <ModuleProvider modules={modules} user={user}>
      {children}
    </ModuleProvider>
  )
}
