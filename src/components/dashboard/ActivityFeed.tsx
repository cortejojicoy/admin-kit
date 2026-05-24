import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

export interface ActivityItem {
  id: string
  title: ReactNode
  description?: ReactNode
  timestamp?: string | Date
  icon?: ReactNode
  actor?: { name?: string; image?: string }
}

export interface ActivityFeedProps {
  items: ActivityItem[]
  emptyState?: ReactNode
  className?: string
}

function formatRelative(timestamp: string | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

export function ActivityFeed({ items, emptyState, className }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className={cn('admin-kit-activity-empty', 'rounded-lg border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500', className)}>
        {emptyState ?? 'No activity yet.'}
      </div>
    )
  }

  return (
    <ul className={cn('admin-kit-activity', 'divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white', className)}>
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 p-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
            {item.icon ?? (item.actor?.image ? <img src={item.actor.image} alt="" className="h-8 w-8 rounded-full" /> : (item.actor?.name?.[0] ?? '•'))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-neutral-900">{item.title}</div>
            {item.description && <div className="text-sm text-neutral-500">{item.description}</div>}
            {item.timestamp && (
              <div className="mt-0.5 text-xs text-neutral-400">{formatRelative(item.timestamp)}</div>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
