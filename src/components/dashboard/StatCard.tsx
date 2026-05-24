import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

export interface StatCardProps {
  label: ReactNode
  value: ReactNode
  delta?: { value: number; label?: ReactNode; direction?: 'up' | 'down' }
  icon?: ReactNode
  className?: string
}

export function StatCard({ label, value, delta, icon, className }: StatCardProps) {
  const isUp = delta ? (delta.direction ?? (delta.value >= 0 ? 'up' : 'down')) === 'up' : false

  return (
    <div className={cn('admin-kit-stat', 'rounded-lg border border-neutral-200 bg-white p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium text-neutral-500">{label}</div>
        {icon && <div className="text-neutral-400">{icon}</div>}
      </div>
      <div className="mt-2 text-2xl font-semibold text-neutral-900">{value}</div>
      {delta && (
        <div
          className={cn(
            'mt-1 inline-flex items-center gap-1 text-xs font-medium',
            isUp ? 'text-emerald-600' : 'text-red-600',
          )}
        >
          <span aria-hidden>{isUp ? '↑' : '↓'}</span>
          <span>{Math.abs(delta.value)}%</span>
          {delta.label && <span className="text-neutral-500">{delta.label}</span>}
        </div>
      )}
    </div>
  )
}
