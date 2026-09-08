'use client'

import type { ReactNode } from 'react'
import { useOne, useResource } from '../../data/hooks'
import type { FieldDescriptor } from '../../data/types'
import { cn } from '../../utils/cn'
import { Card, EmptyState, ErrorMessage, Skeleton } from '../primitives'
import { formatCell, titleize } from './ResourceTable'

export interface ResourceShowProps {
  resource: string
  id: string | number
  fields?: FieldDescriptor[]
  title?: ReactNode
  actions?: ReactNode
  className?: string
}

/** A read-only detail view generated from field descriptors. */
export function ResourceShow({ resource, id, fields, title, actions, className }: ResourceShowProps) {
  const descriptor = useResource(resource)
  const { data, loading, error, allowed } = useOne<Record<string, unknown>>(resource, id)

  if (!allowed) return <EmptyState>You do not have permission to view this record.</EmptyState>

  const shown = fields ?? descriptor?.fields ?? []

  return (
    <Card
      className={cn(className)}
      title={title ?? descriptor?.label ?? titleize(resource)}
      actions={actions}
    >
      <ErrorMessage error={error} />
      <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(8rem, 12rem) 1fr', gap: '0.75rem 1.25rem', margin: 0 }}>
        {shown.map((field) => (
          <div key={field.name} style={{ display: 'contents' }}>
            <dt style={{ color: 'var(--ak-text-muted)', fontSize: '0.8125rem' }}>
              {field.label ?? titleize(field.name)}
            </dt>
            <dd style={{ margin: 0 }}>
              {loading && !data ? <Skeleton width="60%" /> : formatCell(data?.[field.name], field)}
            </dd>
          </div>
        ))}
      </dl>
      {!loading && !data && !error ? <EmptyState>Record not found.</EmptyState> : null}
    </Card>
  )
}
