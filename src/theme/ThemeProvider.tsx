'use client'

import { createContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ThemeConfig } from '../config/types'
import { DARK_TOKENS, DEFAULT_TOKENS, tokensFromPrimary, tokensToStyle } from './tokens'

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

/**
 * The system preference, defaulting to light.
 *
 * `matchMedia` is guarded separately from `window`: it is missing in jsdom and
 * in a few embedded webviews, and a theme provider is not worth taking a whole
 * app down for.
 */
function resolveSystem(): 'light' | 'dark' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(theme?.mode ?? 'system')
  const [systemMode, setSystemMode] = useState<'light' | 'dark'>(resolveSystem)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => setSystemMode(mql.matches ? 'dark' : 'light')
    mql.addEventListener('change', listener)
    return () => mql.removeEventListener('change', listener)
  }, [])

  const resolvedMode = mode === 'system' ? systemMode : mode

  // Destructured first so the memo depends on plain identifiers. Optional-chained
  // member expressions in a dependency array cannot be tracked by the React
  // Compiler, which then skips the whole component.
  const { primaryColor, tokens, className } = theme ?? {}

  // Layering, outermost first: defaults, then the dark overrides when dark is
  // in effect, then the accent derived from `primaryColor`, then the consumer's
  // explicit tokens — which must win over everything, including dark mode.
  const style = useMemo(
    () =>
      tokensToStyle({
        ...DEFAULT_TOKENS,
        ...(resolvedMode === 'dark' ? DARK_TOKENS : {}),
        ...(primaryColor ? tokensFromPrimary(primaryColor) : {}),
        ...(tokens ?? {}),
      }),
    [resolvedMode, primaryColor, tokens],
  )

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolvedMode, setMode }),
    [mode, resolvedMode],
  )

  return (
    <ThemeContext.Provider value={value}>
      <div
        className={['ak-root', className].filter(Boolean).join(' ')}
        data-ak-theme={resolvedMode}
        style={style}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  )
}
