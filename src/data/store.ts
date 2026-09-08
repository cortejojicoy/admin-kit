/**
 * A small query cache.
 *
 * Deliberately not a dependency. What the CRUD hooks actually need is
 * request de-duplication, a subscribable cache, staleness, and invalidation by
 * prefix — that is this file. Anything more sophisticated (window-focus
 * refetching, infinite queries, suspense integration) is better served by
 * bringing React Query and pointing it at the same `DataProvider`, which the
 * provider interface is designed to allow.
 *
 * Framework-free and synchronous to read, so it can be unit-tested without a
 * renderer and driven by `useSyncExternalStore` without tearing.
 */

export type EntryStatus = 'idle' | 'loading' | 'success' | 'error'

export interface CacheEntry<T = unknown> {
  status: EntryStatus
  data?: T
  error?: unknown
  updatedAt?: number
  /** True while a refetch of already-present data is in flight. */
  validating: boolean
}

/**
 * Internal bookkeeping, kept separate from the public snapshot.
 *
 * The separation is load-bearing, not tidiness: `useSyncExternalStore` compares
 * snapshots with `Object.is`, so an entry mutated in place is invisible to
 * React and a component subscribed to it never re-renders. Every state change
 * therefore *replaces* `snapshot` with a new object.
 */
interface InternalEntry<T = unknown> {
  snapshot: CacheEntry<T>
  promise?: Promise<T>
  listeners: Set<() => void>
  fetcher?: () => Promise<T>
}

const IDLE: CacheEntry = Object.freeze({ status: 'idle', validating: false })

export interface StoreOptions {
  /** How long data is considered fresh, in ms. Default 30s. */
  staleTime?: number
  now?: () => number
}

export class DataStore {
  private entries = new Map<string, InternalEntry>()
  private staleTime: number
  private now: () => number

  constructor(options: StoreOptions = {}) {
    this.staleTime = options.staleTime ?? 30_000
    this.now = options.now ?? (() => Date.now())
  }

  /**
   * Current state for a key. Never returns `undefined`, so hooks stay simple,
   * and returns a stable object identity between changes so it is safe to hand
   * straight to `useSyncExternalStore`.
   */
  peek<T>(key: string): CacheEntry<T> {
    const entry = this.entries.get(key)
    if (!entry) return IDLE as CacheEntry<T>
    return entry.snapshot as CacheEntry<T>
  }

  subscribe(key: string, listener: () => void): () => void {
    const entry = this.ensure(key)
    entry.listeners.add(listener)
    return () => {
      entry.listeners.delete(listener)
      // Keep the data but drop the bookkeeping once nobody is watching, so a
      // long-lived session doesn't accumulate an entry per visited page.
      if (entry.listeners.size === 0 && entry.snapshot.status !== 'loading') {
        entry.fetcher = undefined
      }
    }
  }

  /**
   * Read through the cache.
   *
   * Concurrent callers for the same key share one request — a page that mounts
   * six components against the same list must issue one fetch, not six.
   */
  fetch<T>(key: string, fetcher: () => Promise<T>, opts: { force?: boolean } = {}): Promise<T> {
    const entry = this.ensure<T>(key)
    entry.fetcher = fetcher

    if (entry.promise) return entry.promise
    if (!opts.force && entry.snapshot.status === 'success' && !this.isStale(entry)) {
      return Promise.resolve(entry.snapshot.data as T)
    }

    const hadData = entry.snapshot.status === 'success'
    this.patch<T>(key, {
      status: hadData ? 'success' : 'loading',
      validating: hadData,
      error: undefined,
    })

    const promise = fetcher()
      .then((data) => {
        this.patch<T>(key, {
          data,
          status: 'success',
          error: undefined,
          updatedAt: this.now(),
          validating: false,
        })
        return data
      })
      .catch((error: unknown) => {
        this.patch<T>(key, { error, status: 'error', validating: false })
        throw error
      })
      .finally(() => {
        entry.promise = undefined
      })

    entry.promise = promise
    return promise
  }

  /** Write data directly — used for optimistic updates and after mutations. */
  set<T>(key: string, data: T): void {
    this.patch<T>(key, {
      data,
      status: 'success',
      error: undefined,
      updatedAt: this.now(),
      validating: false,
    })
  }

  /** Replace cached data through an updater. Returns the previous value. */
  update<T>(key: string, updater: (previous: T | undefined) => T): T | undefined {
    const entry = this.ensure<T>(key)
    const previous = entry.snapshot.data
    this.patch<T>(key, { data: updater(previous), updatedAt: this.now() })
    return previous
  }

  /**
   * Mark keys stale and refetch the ones something is still watching.
   *
   * Prefix-based, because that is how the keys are built: invalidating
   * `users|` catches every page, sort and filter combination of the users list
   * plus every individual record, which is exactly the blast radius a write to
   * that resource has.
   */
  invalidate(prefix: string): void {
    for (const [key, entry] of this.entries) {
      if (!key.startsWith(prefix)) continue
      this.patch(key, { updatedAt: undefined })
      if (entry.listeners.size > 0 && entry.fetcher) {
        void this.fetch(key, entry.fetcher, { force: true }).catch(() => undefined)
      }
    }
  }

  /** Drop entries entirely. Use on logout, where stale data is a privacy leak. */
  clear(prefix?: string): void {
    for (const [key, entry] of this.entries) {
      if (prefix && !key.startsWith(prefix)) continue
      this.patch(key, {
        data: undefined,
        status: 'idle',
        error: undefined,
        updatedAt: undefined,
        validating: false,
      })
      if (entry.listeners.size === 0) this.entries.delete(key)
    }
  }

  private isStale(entry: InternalEntry): boolean {
    const updatedAt = entry.snapshot.updatedAt
    if (updatedAt == null) return true
    return this.now() - updatedAt > this.staleTime
  }

  /** Replace the snapshot with a new object, then notify. */
  private patch<T>(key: string, changes: Partial<CacheEntry<T>>): void {
    const entry = this.ensure<T>(key)
    entry.snapshot = { ...entry.snapshot, ...changes }
    this.emit(key)
  }

  private ensure<T>(key: string): InternalEntry<T> {
    let entry = this.entries.get(key) as InternalEntry<T> | undefined
    if (!entry) {
      entry = { snapshot: { status: 'idle', validating: false }, listeners: new Set() }
      this.entries.set(key, entry)
    }
    return entry
  }

  private emit(key: string): void {
    const entry = this.entries.get(key)
    if (!entry) return
    for (const listener of entry.listeners) listener()
  }
}

/**
 * Build a cache key.
 *
 * Object keys are sorted so `{page:1,sort:'name'}` and `{sort:'name',page:1}`
 * are one entry rather than two — otherwise every reordered params object
 * silently doubles the request count.
 */
export function cacheKey(resource: string, op: string, params?: unknown): string {
  return `${resource}|${op}|${params === undefined ? '' : stableStringify(params)}`
}

/** Prefix matching every entry for a resource. */
export function resourcePrefix(resource: string): string {
  return `${resource}|`
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
}
