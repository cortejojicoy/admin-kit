'use client'

import { useContext } from 'react'
import { AuthContext } from './AuthContext'
import type { AuthContextValue } from './types'

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside <AdminProvider> / <AuthContextProvider>')
  }
  return ctx
}

/**
 * Non-throwing variant, for optional chrome.
 *
 * A greeting or an avatar rendered outside the provider should degrade, not
 * take the page down with it.
 */
export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext)
}
