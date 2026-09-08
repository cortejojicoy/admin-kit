'use client'

import { createContext, useContext, useMemo } from 'react'
import type { ComponentType, ReactNode } from 'react'
import type { LinkProps } from '../adapters/types'
import { AppLink, useAppPathname, useAppRouter } from '../adapters/appRoute'
import { PagesLink, usePagesPathname, usePagesRouter } from '../adapters/pagesRoute'
import type { RouterFlavor } from '../config/types'

/**
 * The router, resolved once.
 *
 * Every shell, guard and nav item needs the current path and a `<Link>`. In
 * v0.1.x each of them took both as props, so `<AdminLayout>` needed `Link` and
 * `currentPath` passed down from a consumer who had to know which router flavour
 * they were on. Now one bridge resolves it and everything below reads context.
 *
 * The two flavours are separate components rather than one component with a
 * conditional hook call, because `useRouter` from `next/router` and from
 * `next/navigation` cannot both be called in the same render. The branch is on
 * `config.router`, which never changes for the life of the app, so the hook
 * order stays stable.
 */
export interface RouterBridge {
  pathname: string
  push: (href: string) => void
  replace: (href: string) => void
  back: () => void
  Link: ComponentType<LinkProps>
}

const RouterContext = createContext<RouterBridge | null>(null)

export function useRouterBridge(): RouterBridge {
  const ctx = useContext(RouterContext)
  if (!ctx) {
    throw new Error('useRouterBridge must be used inside <AdminProvider>')
  }
  return ctx
}

/** Current path, or `'/'` before hydration. */
export function useCurrentPath(): string {
  return useRouterBridge().pathname
}

function AppRouterBridge({ children }: { children: ReactNode }) {
  const router = useAppRouter()
  const pathname = useAppPathname()
  const value = useMemo<RouterBridge>(
    () => ({ ...router, pathname, Link: AppLink }),
    [router, pathname],
  )
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

function PagesRouterBridge({ children }: { children: ReactNode }) {
  const router = usePagesRouter()
  const pathname = usePagesPathname()
  const value = useMemo<RouterBridge>(
    () => ({ ...router, pathname, Link: PagesLink }),
    [router, pathname],
  )
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function RouterProvider({
  flavor,
  bridge,
  children,
}: {
  flavor: RouterFlavor
  /** Supply your own bridge — for tests, or a router this kit doesn't know. */
  bridge?: RouterBridge
  children: ReactNode
}) {
  if (bridge) return <RouterContext.Provider value={bridge}>{children}</RouterContext.Provider>
  const Bridge = flavor === 'pages' ? PagesRouterBridge : AppRouterBridge
  return <Bridge>{children}</Bridge>
}

/** `true` when `pathname` is `href` or a route nested under it. */
export function isActivePath(pathname: string, href: string | undefined): boolean {
  if (!href) return false
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}
