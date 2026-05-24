import type { ComponentType, ReactNode } from 'react'

export interface RouterAdapter {
  useRouter: () => {
    push: (href: string) => void
    replace: (href: string) => void
    back: () => void
  }
  usePathname: () => string
  useSearchParams: () => URLSearchParams
  Link: ComponentType<LinkProps>
}

export interface LinkProps {
  href: string
  prefetch?: boolean
  replace?: boolean
  className?: string
  children?: ReactNode
  onClick?: (e: unknown) => void
  [key: string]: unknown
}
