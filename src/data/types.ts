import type { AccessLevel } from '../access/levels'

/**
 * The data layer generalizes what v0.1.x only did for login: every operation is
 * an endpoint the installing app declares, not a convention this package
 * invents. Login was pluggable; list/create/update/delete were not, which meant
 * the kit could authenticate against your backend and then had nothing to say
 * about the other 95% of it.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** The five operations every resource has, plus arbitrary named extras. */
export type CrudOperation = 'list' | 'one' | 'create' | 'update' | 'remove'

export interface EndpointDescriptor {
  method?: HttpMethod
  /** Path template. `:param` segments are filled from the call's params. */
  path: string
  /** Extra query values merged into every request for this endpoint. */
  query?: Record<string, string | number | boolean>
  /** Extra headers merged into every request for this endpoint. */
  headers?: Record<string, string>
}

export type ResourceEndpoints = Partial<Record<CrudOperation, string | EndpointDescriptor>> &
  Record<string, string | EndpointDescriptor | undefined>

/**
 * How list parameters serialize into the query string. Every backend spells
 * these differently and none of them are wrong, so the names are config.
 */
export interface QueryNaming {
  page?: string
  perPage?: string
  sort?: string
  order?: string
  search?: string
  /** `'flat'` → `status=active`; `'bracket'` → `filter[status]=active`. */
  filterStyle?: 'flat' | 'bracket'
  /** Prefix for bracket style. Default `filter`. */
  filterKey?: string
  /** 1-based (default) or 0-based paging. */
  pageBase?: 0 | 1
}

export interface ListResult<T = unknown> {
  rows: T[]
  total: number
}

/**
 * Wire-format adapters. These are functions, so they live in the runtime config
 * only — `serializeConfig()` strips them before the config crosses into a
 * client component, and the client re-attaches them from its own import.
 */
export interface ResourceMappers<T = any> {
  /** Extract rows + total from a list response. */
  list?: (raw: any) => ListResult<T>
  /** Extract one record from a single-item response. */
  one?: (raw: any) => T
  /** Shape a record for the wire before create/update. */
  toWire?: (input: any, op: 'create' | 'update') => unknown
  /** Normalize an error body into something renderable. */
  error?: (raw: any, status: number) => NormalizedError
}

export interface NormalizedError {
  message: string
  status?: number
  /** Field-level validation messages, keyed by field name. */
  fields?: Record<string, string | string[]>
  raw?: unknown
}

/** A field on a resource — drives the generated table, form, and detail view. */
export interface FieldDescriptor {
  name: string
  label?: string
  type?:
    | 'string'
    | 'text'
    | 'number'
    | 'boolean'
    | 'date'
    | 'datetime'
    | 'email'
    | 'select'
    | 'reference'
    | 'json'
  /** Options for `select`. */
  options?: Array<{ label: string; value: string | number }>
  /** Resource name for `reference`. */
  reference?: string
  required?: boolean
  readOnly?: boolean
  /** Show in the generated table. Default: true for the first 6 fields. */
  inList?: boolean
  /** Show in the generated form. Default: true unless `readOnly`. */
  inForm?: boolean
  /** Column sortable in the generated table. */
  sortable?: boolean
  placeholder?: string
  help?: string
}

export interface ResourceDescriptor<T = any> {
  /** Stable name, used in cache keys and hook calls. */
  name: string
  /** Human labels for generated UI. Defaults derived from `name`. */
  label?: string
  labelPlural?: string
  /** Property holding the record id. Default `id`. */
  idField?: string
  endpoints: ResourceEndpoints
  query?: QueryNaming
  map?: ResourceMappers<T>
  fields?: FieldDescriptor[]
  /** Permission code required per operation. Enforced by the hooks and guards. */
  permissions?: Partial<Record<CrudOperation | string, string>>
  /** Minimum access level for write operations. Default `full`. */
  writeLevel?: AccessLevel
  /** Default page size for `useList`. Default 25. */
  perPage?: number
}

/* ------------------------------- provider ------------------------------- */

export interface ListParams {
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
  search?: string
  filter?: Record<string, unknown>
  signal?: AbortSignal
}

export interface DataProvider {
  getList: <T = unknown>(resource: string, params?: ListParams) => Promise<ListResult<T>>
  getOne: <T = unknown>(resource: string, params: { id: string | number; signal?: AbortSignal }) => Promise<T>
  getMany: <T = unknown>(resource: string, params: { ids: Array<string | number>; signal?: AbortSignal }) => Promise<T[]>
  create: <T = unknown>(resource: string, params: { data: unknown }) => Promise<T>
  update: <T = unknown>(resource: string, params: { id: string | number; data: unknown; previous?: unknown }) => Promise<T>
  remove: (resource: string, params: { id: string | number }) => Promise<void>
  /** Any endpoint on the resource that isn't one of the five. */
  invoke: <T = unknown>(
    resource: string,
    action: string,
    params?: { id?: string | number; data?: unknown; query?: Record<string, unknown>; signal?: AbortSignal },
  ) => Promise<T>
}
