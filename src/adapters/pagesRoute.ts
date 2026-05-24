'use client'

/**
 * Pages Router adapter. Wraps next/router primitives.
 */
import { useRouter as useNextRouter } from 'next/router'
import NextLink from 'next/link'
import type { ComponentType } from 'react'
import type { LinkProps, RouterAdapter } from './types'

export function usePagesRouter() {
  const r = useNextRouter()
  return {
    push: (href: string) => {
      void r.push(href)
    },
    replace: (href: string) => {
      void r.replace(href)
    },
    back: () => r.back(),
  }
}

export function usePagesPathname(): string {
  const r = useNextRouter()
  return r.pathname
}

export function usePagesSearchParams(): URLSearchParams {
  const r = useNextRouter()
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(r.query)) {
    if (Array.isArray(v)) v.forEach((vv) => params.append(k, vv))
    else if (v != null) params.set(k, String(v))
  }
  return params
}

export const PagesLink = NextLink as unknown as ComponentType<LinkProps>

export const pagesRouterAdapter: RouterAdapter = {
  useRouter: usePagesRouter,
  usePathname: usePagesPathname,
  useSearchParams: usePagesSearchParams,
  Link: PagesLink,
}
