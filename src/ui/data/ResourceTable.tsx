'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAccess } from '../../access/AccessProvider'
import { useDelete, useList, useResource } from '../../data/hooks'
import type { FieldDescriptor, ResourceDescriptor } from '../../data/types'
import { useRouterBridge } from '../../context/RouterContext'
import { cn, interpolate, toText } from '../../utils/cn'
import { Button, Card, EmptyState, ErrorMessage, SearchInput, Skeleton } from '../primitives'

export interface ResourceTableProps {
  resource: string
  title?: ReactNode
  /** Override which fields become columns. */
  fields?: FieldDescriptor[]
  /**
   * Makes rows navigable. Prefer the string form — `'/admin/users/:id'` — which
   * is serializable, so the page rendering this table can stay a server
   * component. The function form is available from client pages.
   */
  hrefFor?: string | ((row: Record<string, unknown>) => string)
  /** Extra controls in the header. */
  actions?: ReactNode
  /** Per-row controls, rendered after the built-in delete. */
  rowActions?: (row: Record<string, unknown>) => ReactNode
  searchable?: boolean
  className?: string
}

/**
 * A table generated from a resource's field descriptors.
 *
 * Everything it does — which columns, which endpoint, which permissions gate
 * the delete button — comes from the resource definition, so a full list screen
 * is `<ResourceTable resource="users" />`. Anything it can't express is a reason
 * to write the table by hand and keep the hooks, not a reason to add a dozen
 * props here.
 */
export function ResourceTable({
  resource,
  title,
  fields,
  hrefFor,
  actions,
  rowActions,
  searchable = true,
  className,
}: ResourceTableProps) {
  const descriptor = useResource(resource)
  const access = useAccess()
  const { Link } = useRouterBridge()

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<string | undefined>(undefined)
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')

  const columns = useMemo(
    () => fields ?? listColumns(descriptor),
    [fields, descriptor],
  )

  const { rows, total, loading, error, allowed, page, pageCount, setPage, refetch } = useList<
    Record<string, unknown>
  >(resource, { search: search || undefined, sort, order })

  const del = useDelete(resource)
  const idField = descriptor?.idField ?? 'id'
  const canDelete = del.allowed && Boolean(descriptor?.endpoints.remove)

  if (!allowed) {
    return <EmptyState>You do not have permission to view this list.</EmptyState>
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(field)
      setOrder('asc')
    }
  }

  return (
    <Card
      className={cn(className)}
      title={title ?? descriptor?.labelPlural ?? titleize(resource)}
      actions={
        <>
          {searchable ? (
            <SearchInput
              placeholder="Search…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              style={{ maxWidth: '14rem' }}
            />
          ) : null}
          {actions}
        </>
      }
      bodyClassName="ak-table-wrap"
    >
      <ErrorMessage error={error} />

      <table className="ak-table">
        <thead>
          <tr>
            {columns.map((field) => (
              <th
                key={field.name}
                data-sortable={field.sortable || undefined}
                aria-sort={sort === field.name ? (order === 'asc' ? 'ascending' : 'descending') : undefined}
                onClick={field.sortable ? () => toggleSort(field.name) : undefined}
              >
                {field.label ?? titleize(field.name)}
                {sort === field.name ? (order === 'asc' ? ' ↑' : ' ↓') : null}
              </th>
            ))}
            {canDelete || rowActions ? <th aria-label="Actions" /> : null}
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0
            ? Array.from({ length: 5 }, (_, i) => (
                <tr key={`skeleton-${i}`}>
                  {columns.map((field) => (
                    <td key={field.name}>
                      <Skeleton />
                    </td>
                  ))}
                  {canDelete || rowActions ? <td /> : null}
                </tr>
              ))
            : rows.map((row, index) => {
                const id = row[idField]
                const href =
                  typeof hrefFor === 'string' ? interpolate(hrefFor, row) : hrefFor?.(row)
                return (
                  <tr key={toText(id, String(index))}>
                    {columns.map((field, columnIndex) => (
                      <td key={field.name}>
                        {columnIndex === 0 && href ? (
                          <Link href={href}>{formatCell(row[field.name], field)}</Link>
                        ) : (
                          formatCell(row[field.name], field)
                        )}
                      </td>
                    ))}
                    {canDelete || rowActions ? (
                      <td>
                        <div className="ak-table__actions">
                          {rowActions?.(row)}
                          {canDelete && id != null ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              iconKey="trash"
                              iconOnly
                              aria-label={`Delete ${toText(id)}`}
                              disabled={del.loading}
                              onClick={() => {
                                void del
                                  .mutate({ id: id as string | number })
                                  .then(() => refetch())
                                  .catch(() => undefined)
                              }}
                            />
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                )
              })}
        </tbody>
      </table>

      {!loading && rows.length === 0 ? <EmptyState /> : null}

      <div className="ak-pagination">
        <span>
          {total} {total === 1 ? 'record' : 'records'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {pageCount}
          </span>
          <Button size="sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </span>
      </div>
      <ErrorMessage error={del.error} />
      {access.isAdmin ? null : null}
    </Card>
  )
}

/**
 * Which fields become columns.
 *
 * Capped at six by default: a generated table that renders every field of a
 * wide record produces a horizontally scrolling wall nobody can read, and
 * picking the first few is both predictable and easy to override.
 */
export function listColumns(descriptor: ResourceDescriptor | undefined): FieldDescriptor[] {
  const fields = descriptor?.fields ?? []
  const explicit = fields.filter((f) => f.inList === true)
  if (explicit.length > 0) return explicit
  return fields.filter((f) => f.inList !== false).slice(0, 6)
}

export function formatCell(value: unknown, field: FieldDescriptor): ReactNode {
  if (value == null || value === '') return '—'
  switch (field.type) {
    case 'boolean':
      return value ? 'Yes' : 'No'
    case 'date':
      return formatDate(value, false)
    case 'datetime':
      return formatDate(value, true)
    case 'select': {
      const option = field.options?.find((o) => toText(o.value) === toText(value))
      return option?.label ?? toText(value)
    }
    case 'json':
      return <code style={{ fontFamily: 'var(--ak-font-mono)', fontSize: '0.75rem' }}>{JSON.stringify(value)}</code>
    default:
      return toText(value)
  }
}

function formatDate(value: unknown, withTime: boolean): string {
  const text = toText(value)
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return withTime ? date.toLocaleString() : date.toLocaleDateString()
}

export function titleize(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
}
