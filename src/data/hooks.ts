'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useAccess } from '../access/AccessProvider'
import { useAdminConfig } from '../context/AdminConfigContext'
import { useDataProvider, useDataStore } from './context'
import { cacheKey, resourcePrefix, type CacheEntry } from './store'
import type { ListParams, ListResult, ResourceDescriptor } from './types'

/** Look up a resource descriptor from the mounted config. */
export function useResource(name: string): ResourceDescriptor | undefined {
  const config = useAdminConfig()
  return useMemo(() => config.resources.find((r) => r.name === name), [config.resources, name])
}

/**
 * Subscribe to one cache entry.
 *
 * `useSyncExternalStore` rather than `useState` + an effect: the store is
 * mutated outside React (by mutations, by invalidation, by another component's
 * fetch), and this is the only way to read it without tearing under concurrent
 * rendering.
 */
function useEntry<T>(key: string): CacheEntry<T> {
  const store = useDataStore()
  const subscribe = useCallback((cb: () => void) => store.subscribe(key, cb), [store, key])
  const getSnapshot = useCallback(() => store.peek<T>(key), [store, key])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export interface UseListOptions extends Omit<ListParams, 'signal'> {
  /** Skip fetching (e.g. while a dependency is still unknown). */
  enabled?: boolean
}

export interface UseListResult<T> {
  rows: T[]
  total: number
  loading: boolean
  /** A refetch is in flight while previous data is still on screen. */
  validating: boolean
  error: unknown
  /** Whether the user may read this resource at all. */
  allowed: boolean
  page: number
  perPage: number
  pageCount: number
  setPage: (page: number) => void
  refetch: () => Promise<void>
}

/**
 * Read a paginated list.
 *
 * The permission check happens here rather than only in the UI: a table the
 * user may not read should not issue the request that will 403, because that is
 * a log full of alarming failures for a screen that simply should not have
 * asked.
 */
export function useList<T = unknown>(resource: string, options: UseListOptions = {}): UseListResult<T> {
  const provider = useDataProvider()
  const store = useDataStore()
  const descriptor = useResource(resource)
  const access = useAccess()

  const perPage = options.perPage ?? descriptor?.perPage ?? 25
  const [page, setPage] = useState(options.page ?? 1)

  const permission = descriptor?.permissions?.list
  const allowed = permission ? access.can(permission, 'view') : true

  const params = useMemo<ListParams>(
    () => ({
      page,
      perPage,
      sort: options.sort,
      order: options.order,
      search: options.search,
      filter: options.filter,
    }),
    [page, perPage, options.sort, options.order, options.search, options.filter],
  )

  const key = cacheKey(resource, 'list', params)
  const entry = useEntry<ListResult<T>>(key)
  const enabled = (options.enabled ?? true) && allowed

  useEffect(() => {
    if (!enabled) return
    void store.fetch(key, () => provider.getList<T>(resource, params)).catch(() => undefined)
  }, [enabled, store, key, provider, resource, params])

  const refetch = useCallback(async () => {
    await store.fetch(key, () => provider.getList<T>(resource, params), { force: true }).catch(() => undefined)
  }, [store, key, provider, resource, params])

  const total = entry.data?.total ?? 0

  return {
    rows: entry.data?.rows ?? [],
    total,
    loading: entry.status === 'loading',
    validating: entry.validating,
    error: enabled ? entry.error : undefined,
    allowed,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
    setPage,
    refetch,
  }
}

export interface UseOneResult<T> {
  data: T | undefined
  loading: boolean
  error: unknown
  allowed: boolean
  refetch: () => Promise<void>
}

export function useOne<T = unknown>(
  resource: string,
  id: string | number | undefined | null,
  options: { enabled?: boolean } = {},
): UseOneResult<T> {
  const provider = useDataProvider()
  const store = useDataStore()
  const descriptor = useResource(resource)
  const access = useAccess()

  const permission = descriptor?.permissions?.one ?? descriptor?.permissions?.list
  const allowed = permission ? access.can(permission, 'view') : true
  const enabled = (options.enabled ?? true) && allowed && id != null && id !== ''

  const key = cacheKey(resource, 'one', id ?? null)
  const entry = useEntry<T>(key)

  useEffect(() => {
    if (!enabled) return
    void store.fetch(key, () => provider.getOne<T>(resource, { id: id })).catch(() => undefined)
  }, [enabled, store, key, provider, resource, id])

  const refetch = useCallback(async () => {
    if (!enabled) return
    await store.fetch(key, () => provider.getOne<T>(resource, { id: id }), { force: true }).catch(() => undefined)
  }, [enabled, store, key, provider, resource, id])

  return {
    data: entry.data,
    loading: entry.status === 'loading',
    error: enabled ? entry.error : undefined,
    allowed,
    refetch,
  }
}

export interface MutationResult<TArgs, TResult> {
  mutate: (args: TArgs) => Promise<TResult>
  loading: boolean
  error: unknown
  reset: () => void
  /** Whether the user may perform this operation. */
  allowed: boolean
}

function useMutation<TArgs, TResult>(
  resource: string,
  operation: string,
  run: (args: TArgs) => Promise<TResult>,
): MutationResult<TArgs, TResult> {
  const store = useDataStore()
  const descriptor = useResource(resource)
  const access = useAccess()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(undefined)

  // A component that unmounts mid-request must not set state afterwards, and a
  // deleted row's dialog unmounts exactly then.
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const permission = descriptor?.permissions?.[operation]
  const level = descriptor?.writeLevel ?? 'full'
  const allowed = permission ? access.can(permission, level) : true

  const mutate = useCallback(
    async (args: TArgs) => {
      if (!allowed) {
        const err = new Error(`Not permitted: ${permission ?? operation} on ${resource}`)
        setError(err)
        throw err
      }
      setLoading(true)
      setError(undefined)
      try {
        const result = await run(args)
        store.invalidate(resourcePrefix(resource))
        return result
      } catch (err) {
        if (mounted.current) setError(err)
        throw err
      } finally {
        if (mounted.current) setLoading(false)
      }
    },
    [allowed, permission, operation, resource, run, store],
  )

  return { mutate, loading, error, reset: () => setError(undefined), allowed }
}

export function useCreate<T = unknown>(resource: string) {
  const provider = useDataProvider()
  return useMutation<{ data: unknown }, T>(resource, 'create', ({ data }) =>
    provider.create<T>(resource, { data }),
  )
}

export function useUpdate<T = unknown>(resource: string) {
  const provider = useDataProvider()
  const store = useDataStore()
  const descriptor = useResource(resource)
  const idField = descriptor?.idField ?? 'id'

  return useMutation<{ id: string | number; data: unknown }, T>(resource, 'update', async ({ id, data }) => {
    const key = cacheKey(resource, 'one', id)
    // Optimistic: merge the patch into the cached record so the form reflects
    // the change immediately, and put the original back if the write fails.
    const previous = store.update<Record<string, unknown>>(key, (current) => ({
      ...(current ?? {}),
      ...(data as Record<string, unknown>),
      [idField]: id,
    }))
    try {
      return await provider.update<T>(resource, { id, data, previous })
    } catch (err) {
      if (previous !== undefined) store.set(key, previous)
      throw err
    }
  })
}

export function useDelete(resource: string) {
  const provider = useDataProvider()
  return useMutation<{ id: string | number }, void>(resource, 'remove', ({ id }) =>
    provider.remove(resource, { id }),
  )
}

/** Call any non-CRUD endpoint declared on the resource. */
export function useAction<T = unknown>(resource: string, action: string) {
  const provider = useDataProvider()
  return useMutation<{ id?: string | number; data?: unknown; query?: Record<string, unknown> }, T>(
    resource,
    action,
    (params) => provider.invoke<T>(resource, action, params),
  )
}
