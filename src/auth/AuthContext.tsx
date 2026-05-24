'use client'

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AuthConfig } from '../config/types'
import { createJWTProvider } from './providers/JWTProvider'
import { createOAuthProvider } from './providers/OAuthProvider'
import { createCustomProvider } from './providers/CustomProvider'
import type { AuthContextValue, AuthProvider, AuthSession, AuthState } from './types'

export const AuthContext = createContext<AuthContextValue | null>(null)

function resolveProvider(auth: AuthConfig): AuthProvider {
  switch (auth.provider) {
    case 'jwt':
      if (!auth.jwt) throw new Error('config.auth.jwt is required when provider is "jwt"')
      return createJWTProvider(auth.jwt)
    case 'oauth':
      if (!auth.oauth) throw new Error('config.auth.oauth is required when provider is "oauth"')
      return createOAuthProvider(auth.oauth)
    case 'custom':
      if (!auth.custom) throw new Error('config.auth.custom is required when provider is "custom"')
      return createCustomProvider(auth.custom)
    default:
      throw new Error(`Unknown auth provider: ${(auth as { provider: string }).provider}`)
  }
}

export interface AuthContextProviderProps {
  config: AuthConfig
  children: ReactNode
  initialSession?: AuthSession | null
}

export function AuthContextProvider({ config, children, initialSession = null }: AuthContextProviderProps) {
  const providerRef = useRef<AuthProvider | null>(null)
  if (providerRef.current === null) providerRef.current = resolveProvider(config)
  const provider = providerRef.current

  const [state, setState] = useState<AuthState>(() => ({
    status: initialSession ? 'authenticated' : 'loading',
    user: initialSession?.user ?? null,
    session: initialSession,
    error: null,
  }))

  useEffect(() => {
    if (initialSession) return
    let cancelled = false
    ;(async () => {
      try {
        const session = (await provider.initialize?.()) ?? (await provider.getSession())
        if (cancelled) return
        setState({
          status: session ? 'authenticated' : 'unauthenticated',
          user: session?.user ?? null,
          session,
          error: null,
        })
      } catch (err) {
        if (cancelled) return
        setState({
          status: 'unauthenticated',
          user: null,
          session: null,
          error: err instanceof Error ? err.message : 'Failed to load session',
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [provider, initialSession])

  const login = useCallback(
    async (credentials: Record<string, unknown>) => {
      setState((s) => ({ ...s, status: 'loading', error: null }))
      try {
        const session = await provider.login(credentials)
        setState({ status: 'authenticated', user: session.user, session, error: null })
        return session
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed'
        setState({ status: 'unauthenticated', user: null, session: null, error: message })
        throw err
      }
    },
    [provider],
  )

  const logout = useCallback(async () => {
    await provider.logout()
    setState({ status: 'unauthenticated', user: null, session: null, error: null })
  }, [provider])

  const getSession = useCallback(() => provider.getSession(), [provider])
  const refresh = useMemo(
    () =>
      provider.refresh
        ? async () => {
            const session = await provider.refresh!()
            setState({
              status: session ? 'authenticated' : 'unauthenticated',
              user: session?.user ?? null,
              session,
              error: null,
            })
            return session
          }
        : undefined,
    [provider],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isAuthenticated: state.status === 'authenticated',
      isLoading: state.status === 'loading',
      login,
      logout,
      getSession,
      refresh,
    }),
    [state, login, logout, getSession, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
