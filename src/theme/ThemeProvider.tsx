'use client'

import { createContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ThemeConfig } from '../config/types'
import { DEFAULT_TOKENS, tokensToStyle } from './tokens'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeContextValue {
  mode: ThemeMode
  resolvedMode: 'light' | 'dark'
  setMode: (m: ThemeMode) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export interface ThemeProviderProps {
  theme?: ThemeConfig
  children: ReactNode
}

function resolveSystem(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(theme?.mode ?? 'system')
  const [systemMode, setSystemMode] = useState<'light' | 'dark'>(resolveSystem)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => setSystemMode(mql.matches ? 'dark' : 'light')
    mql.addEventListener('change', listener)
    return () => mql.removeEventListener('change', listener)
  }, [])

  const resolvedMode = mode === 'system' ? systemMode : mode

  const style = useMemo(
    () => tokensToStyle({ ...DEFAULT_TOKENS, ...(theme?.tokens ?? {}) }),
    [theme?.tokens],
  )

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolvedMode, setMode }),
    [mode, resolvedMode],
  )

  return (
    <ThemeContext.Provider value={value}>
      <div data-admin-kit data-theme={resolvedMode} style={style} className={theme?.className}>
        {children}
      </div>
    </ThemeContext.Provider>
  )
}
