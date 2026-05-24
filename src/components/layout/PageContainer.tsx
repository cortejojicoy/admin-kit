import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

export interface PageContainerProps {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
  contentClassName?: string
}

export function PageContainer({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: PageContainerProps) {
  return (
    <div className={cn('admin-kit-page', 'p-6', className)}>
      {(title || description || actions) && (
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            {title && <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>}
            {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn('admin-kit-page-content', contentClassName)}>{children}</div>
    </div>
  )
}
