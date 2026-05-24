'use client'

/**
 * App Router adapter. Re-exports / wraps next/navigation primitives so the
 * rest of the package can stay router-agnostic.
 *
 * Consumers using the Pages Router should import from './pagesRoute' instead.
 */
import { useRouter as useNextRouter, usePathname as useNextPathname, useSearchParams as useNextSearchParams } from 'next/navigation'
import NextLink from 'next/link'
import type { ComponentType } from 'react'
import type { LinkProps, RouterAdapter } from './types'

export function useAppRouter() {
  const r = useNextRouter()
  return {
    push: (href: string) => r.push(href),
    replace: (href: string) => r.replace(href),
    back: () => r.back(),
  }
}

export function useAppPathname(): string {
  return useNextPathname() ?? '/'
}

export function useAppSearchParams(): URLSearchParams {
  const sp = useNextSearchParams()
  return new URLSearchParams(sp?.toString() ?? '')
}

export const AppLink = NextLink as unknown as ComponentType<LinkProps>

export const appRouterAdapter: RouterAdapter = {
  useRouter: useAppRouter,
  usePathname: useAppPathname,
  useSearchParams: useAppSearchParams,
  Link: AppLink,
}
