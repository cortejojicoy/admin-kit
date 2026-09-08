import { createHttpClient, HttpError, type HttpClient, type HttpClientOptions } from '../http/client'
import { toText } from '../utils/cn'
import type {
  CrudOperation,
  DataProvider,
  EndpointDescriptor,
  HttpMethod,
  ListParams,
  ListResult,
  QueryNaming,
  ResourceDescriptor,
} from './types'

const DEFAULT_METHODS: Record<CrudOperation, HttpMethod> = {
  list: 'GET',
  one: 'GET',
  create: 'POST',
  update: 'PATCH',
  remove: 'DELETE',
}

export interface RestProviderOptions extends Omit<HttpClientOptions, 'mapError'> {
  resources?: ResourceDescriptor[]
  /** Supply a pre-built client (shares the session with auth). */
  client?: HttpClient
}

/**
 * The REST data provider.
 *
 * Everything backend-shaped is declared by the installing app: the path, the
 * verb, how list parameters are named, and how responses unwrap. This package
 * contributes no conventions of its own beyond sensible fallbacks — which is
 * the whole point, since "our admin kit needs your API to look like this" is
 * the reason most of them go unused.
 *
 * GraphQL, tRPC or an SDK-backed provider is a different implementation of
 * `DataProvider`, not a fork of this one.
 */
export function createRestDataProvider(options: RestProviderOptions = {}): DataProvider {
  const resources = new Map((options.resources ?? []).map((r) => [r.name, r]))

  function resourceOf(name: string): ResourceDescriptor {
    const resource = resources.get(name)
    if (!resource) {
      const known = [...resources.keys()].join(', ') || 'none'
      throw new Error(`Unknown resource "${name}". Declared resources: ${known}.`)
    }
    return resource
  }

  function clientFor(resource: ResourceDescriptor): HttpClient {
    // A per-resource client, so `map.error` can normalize that resource's
    // error envelope without every other resource inheriting it.
    if (options.client && !resource.map?.error) return options.client
    return createHttpClient({ ...options, mapError: resource.map?.error })
  }

  async function call<T>(
    resourceName: string,
    op: string,
    params: {
      id?: string | number
      data?: unknown
      query?: Record<string, unknown>
      signal?: AbortSignal
      wireOp?: 'create' | 'update'
    } = {},
  ): Promise<T> {
    const resource = resourceOf(resourceName)
    const endpoint = normalizeEndpoint(resource, op)
    const { path, leftover } = fillPath(endpoint.path, {
      id: params.id,
      ...(isRecord(params.data) ? params.data : {}),
    })

    const body =
      params.data === undefined
        ? undefined
        : params.wireOp && resource.map?.toWire
          ? resource.map.toWire(params.data, params.wireOp)
          : params.data

    return clientFor(resource).request<T>({
      method: endpoint.method,
      path,
      query: { ...endpoint.query, ...params.query, ...leftover },
      headers: endpoint.headers,
      body,
      signal: params.signal,
    })
  }

  function normalizeEndpoint(resource: ResourceDescriptor, op: string): Required<Pick<EndpointDescriptor, 'path'>> & EndpointDescriptor {
    const raw = resource.endpoints[op]
    if (!raw) {
      throw new Error(
        `Resource "${resource.name}" has no "${op}" endpoint. ` +
          `Add it to endpoints in the resource definition.`,
      )
    }
    const descriptor = typeof raw === 'string' ? { path: raw } : raw
    return {
      ...descriptor,
      method: descriptor.method ?? DEFAULT_METHODS[op as CrudOperation] ?? 'POST',
    }
  }

  const provider: DataProvider = {
    async getList<T>(name: string, params: ListParams = {}): Promise<ListResult<T>> {
      const resource = resourceOf(name)
      const raw = await call<unknown>(name, 'list', {
        query: buildListQuery(params, resource.query, resource.perPage),
        signal: params.signal,
      })
      return resource.map?.list ? resource.map.list(raw) : defaultListMapper<T>(raw)
    },

    async getOne<T>(name: string, params: { id: string | number; signal?: AbortSignal }) {
      const resource = resourceOf(name)
      const raw = await call<unknown>(name, 'one', { id: params.id, signal: params.signal })
      return (resource.map?.one ? resource.map.one(raw) : defaultOneMapper(raw)) as T
    },

    async getMany<T>(name: string, params: { ids: Array<string | number>; signal?: AbortSignal }) {
      const resource = resourceOf(name)
      // A backend with a real batch endpoint is far cheaper than N round trips,
      // so use one when it's declared and fall back to fan-out when it isn't.
      if (resource.endpoints.many) {
        const raw = await call<unknown>(name, 'many', {
          query: { ids: params.ids },
          signal: params.signal,
        })
        return (resource.map?.list ? resource.map.list(raw).rows : defaultListMapper<T>(raw).rows) as T[]
      }
      return Promise.all(
        params.ids.map((id: string | number) => provider.getOne<T>(name, { id, signal: params.signal })),
      )
    },

    async create<T>(name: string, params: { data: unknown }) {
      const resource = resourceOf(name)
      const raw = await call<unknown>(name, 'create', { data: params.data, wireOp: 'create' })
      return (resource.map?.one ? resource.map.one(raw) : defaultOneMapper(raw)) as T
    },

    async update<T>(name: string, params: { id: string | number; data: unknown; previous?: unknown }) {
      const resource = resourceOf(name)
      const raw = await call<unknown>(name, 'update', {
        id: params.id,
        data: params.data,
        wireOp: 'update',
      })
      return (resource.map?.one ? resource.map.one(raw) : defaultOneMapper(raw)) as T
    },

    async remove(name: string, params: { id: string | number }) {
      await call<unknown>(name, 'remove', { id: params.id })
    },

    invoke<T>(
      name: string,
      action: string,
      params: { id?: string | number; data?: unknown; query?: Record<string, unknown>; signal?: AbortSignal } = {},
    ) {
      return call<T>(name, action, params)
    },
  }

  return provider
}

/* ------------------------------- helpers -------------------------------- */

/**
 * Fill `:param` segments from the supplied values, and report which values were
 * consumed so the caller doesn't also send them as query parameters.
 */
export function fillPath(
  template: string,
  values: Record<string, unknown>,
): { path: string; leftover: Record<string, unknown> } {
  const used = new Set<string>()
  const path = template.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_match, key: string) => {
    const value = values[key]
    if (value == null) {
      throw new Error(`Missing "${key}" for path "${template}"`)
    }
    used.add(key)
    return encodeURIComponent(toText(value))
  })
  // Only `id` is implicit; body fields stay in the body.
  const leftover: Record<string, unknown> = {}
  if (!used.has('id') && values.id != null) leftover.id = values.id
  return { path, leftover: used.has('id') ? {} : leftover }
}

export function buildListQuery(
  params: ListParams,
  naming: QueryNaming = {},
  defaultPerPage = 25,
): Record<string, unknown> {
  const q: Record<string, unknown> = {}
  const pageBase = naming.pageBase ?? 1

  if (params.page != null) q[naming.page ?? 'page'] = params.page - 1 + pageBase
  q[naming.perPage ?? 'perPage'] = params.perPage ?? defaultPerPage
  if (params.sort) q[naming.sort ?? 'sort'] = params.sort
  if (params.order) q[naming.order ?? 'order'] = params.order
  if (params.search) q[naming.search ?? 'q'] = params.search

  for (const [key, value] of Object.entries(params.filter ?? {})) {
    if (value == null || value === '') continue
    if ((naming.filterStyle ?? 'flat') === 'bracket') {
      q[`${naming.filterKey ?? 'filter'}[${key}]`] = value
    } else {
      q[key] = value
    }
  }
  return q
}

/**
 * Unwrap a list response without being told how.
 *
 * The four shapes below cover essentially every REST backend, and guessing
 * wrong renders an empty table with no error — so when none of them match, say
 * so loudly rather than returning zero rows.
 */
export function defaultListMapper<T>(raw: unknown): ListResult<T> {
  if (Array.isArray(raw)) return { rows: raw as T[], total: raw.length }

  if (isRecord(raw)) {
    for (const key of ['data', 'items', 'results', 'rows', 'records']) {
      const value = raw[key]
      if (Array.isArray(value)) {
        return { rows: value as T[], total: findTotal(raw) ?? value.length }
      }
    }
  }

  throw new HttpError({
    message:
      'Could not find rows in the list response. Add `map.list` to the resource to describe its shape.',
    status: 0,
    raw,
  })
}

function findTotal(raw: Record<string, unknown>): number | undefined {
  const direct = raw.total ?? raw.count ?? raw.totalCount ?? raw.total_count
  if (typeof direct === 'number') return direct
  for (const key of ['meta', 'pagination', 'page']) {
    const nested = raw[key]
    if (isRecord(nested)) {
      const value = nested.total ?? nested.count ?? nested.totalCount ?? nested.total_count
      if (typeof value === 'number') return value
    }
  }
  return undefined
}

export function defaultOneMapper(raw: unknown): unknown {
  if (isRecord(raw)) {
    const data = raw.data
    if (isRecord(data)) return data
    if (isRecord(raw.record)) return raw.record
  }
  return raw
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
