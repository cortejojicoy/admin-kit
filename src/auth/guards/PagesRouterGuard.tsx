'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../useAuth'
import { usePagesRouter, usePagesPathname } from '../../adapters/pagesRoute'

export interface PagesRouterGuardProps {
  loginPath?: string
  publicRoutes?: string[]
  fallback?: ReactNode
  children: ReactNode
}

export function PagesRouterGuard({
  loginPath = '/login',
  publicRoutes = [],
  fallback = null,
  children,
}: PagesRouterGuardProps) {
  const { status, isAuthenticated } = useAuth()
  const router = usePagesRouter()
  const pathname = usePagesPathname()
  const isPublic = publicRoutes.some((p) => pathname === p || pathname.startsWith(p + '/'))

  useEffect(() => {
    if (status === 'loading' || status === 'idle') return
    if (!isAuthenticated && !isPublic && pathname !== loginPath) {
      const next = encodeURIComponent(pathname)
      router.replace(`${loginPath}?next=${next}`)
    }
  }, [status, isAuthenticated, isPublic, pathname, loginPath, router])

  if (status === 'loading' || status === 'idle') return <>{fallback}</>
  if (!isAuthenticated && !isPublic && pathname !== loginPath) return <>{fallback}</>
  return <>{children}</>
}
