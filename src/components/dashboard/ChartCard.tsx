import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

export interface ChartCardProps {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
  contentClassName?: string
}

/**
 * Lightweight chart card shell — does not ship a chart library. Plug in
 * recharts / chart.js / visx in `children`.
 */
export function ChartCard({ title, subtitle, actions, children, className, contentClassName }: ChartCardProps) {
  return (
    <div className={cn('admin-kit-chart-card', 'rounded-lg border border-neutral-200 bg-white', className)}>
      {(title || subtitle || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 p-4">
          <div>
            {title && <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn('p-4', contentClassName)}>{children}</div>
    </div>
  )
}
