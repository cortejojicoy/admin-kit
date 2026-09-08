'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import { useAccess } from '../access/AccessProvider'
import { useAdminConfig } from '../context/AdminConfigContext'
import { useRouterBridge } from '../context/RouterContext'
import type { AccessLevel } from '../access/levels'
import { EmptyState } from './primitives'

export interface RequireAuthProps {
  children: ReactNode
  /** Rendered while the session is resolving, and instead of a denied page. */
  fallback?: ReactNode
  /** Extra public paths, on top of `config.auth.publicRoutes`. */
  publicRoutes?: string[]
}

/**
 * Client-side redirect for unauthenticated users.
 *
 * Router-agnostic now: v0.1.x shipped `AppRouterGuard` and `PagesRouterGuard`
 * as separate components because each imported its own router. The bridge
 * handles that, so there is one guard.
 *
 * Like the middleware, this is a **UX** guard. It stops a shell from rendering
 * and firing requests that will all fail; it does not protect data. The gate is
 * on the server.
 */
export function RequireAuth({ children, fallback = null, publicRoutes = [] }: RequireAuthProps) {
  const config = useAdminConfig()
  const { status, isAuthenticated } = useAuth()
  const { pathname, replace } = useRouterBridge()

  const loginPath = config.auth.loginPage.path ?? '/login'
  const routes = [...(config.auth.publicRoutes ?? []), ...publicRoutes]
  const isPublic =
    pathname === loginPath || routes.some((p) => pathname === p || pathname.startsWith(p + '/'))

  const resolving = status === 'loading' || status === 'idle'
  const denied = !resolving && !isAuthenticated && !isPublic

  useEffect(() => {
    if (!denied) return
    const next = encodeURIComponent(pathname)
    replace(`${loginPath}?next=${next}`)
  }, [denied, pathname, loginPath, replace])

  if (isPublic) return <>{children}</>
  if (resolving || denied) return <>{fallback}</>
  return <>{children}</>
}

export interface RequirePermissionProps {
  /** Permission code required. */
  code?: string
  anyOf?: string[]
  level?: AccessLevel
  /** Require an administrator. */
  admin?: boolean
  /** Rendered instead of the children when denied. */
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Hide a subtree the user may not see.
 *
 * Pair it with a server guard on the same route. This prevents a page from
 * rendering; `requireModule()` on the server is what makes the URL unreachable.
 */
export function RequirePermission({
  code,
  anyOf,
  level,
  admin,
  fallback,
  children,
}: RequirePermissionProps) {
  const access = useAccess()

  const ok =
    (!admin || access.isAdmin) &&
    (code == null || access.can(code, level)) &&
    (anyOf == null || access.canAny(anyOf, level))

  if (!ok) {
    return <>{fallback ?? <EmptyState>You do not have access to this page.</EmptyState>}</>
  }
  return <>{children}</>
}

/** @deprecated Use `RequireAuth`; the router is resolved from config now. */
export const AppRouterGuard = RequireAuth
/** @deprecated Use `RequireAuth`; the router is resolved from config now. */
export const PagesRouterGuard = RequireAuth
