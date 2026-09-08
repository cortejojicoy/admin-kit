import type { NormalizedError } from '../data/types'
import { toText } from '../utils/cn'

/**
 * One HTTP client for the whole kit.
 *
 * Auth, the data layer and the access resolvers all talk to the same backend
 * with the same credentials, so token attachment, the `401 → refresh → retry`
 * dance, and error normalization are written once here rather than three times.
 * Making auth pluggable is only worth something if everything else rides on the
 * session it establishes.
 */

export interface HttpRequest {
  method?: string
  path: string
  query?: Record<string, unknown>
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
  /** Skip the refresh-and-retry behaviour (used by the refresh call itself). */
  noRetry?: boolean
}

export interface HttpClientOptions {
  /** Prefixed onto relative paths. Required for server-side fetches. */
  baseUrl?: string
  /** Token to send, if the client is allowed to hold one. */
  getToken?: () => string | null | undefined | Promise<string | null | undefined>
  /** Header the token goes in. Default `Authorization: Bearer …`. */
  authHeader?: { name: string; prefix?: string }
  /** Static or per-request extra headers. */
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>)
  /** Swap in a custom fetch (tests, tracing, retries). */
  fetch?: typeof fetch
  credentials?: RequestCredentials
  /**
   * Called once on a 401. Return `true` if a new session was obtained, and the
   * original request is retried exactly once.
   */
  onUnauthorized?: () => Promise<boolean>
  /** Turn an error body into something renderable. */
  mapError?: (raw: unknown, status: number) => NormalizedError
}

export class HttpError extends Error implements NormalizedError {
  readonly status: number
  readonly fields?: Record<string, string | string[]>
  readonly raw?: unknown

  constructor(normalized: NormalizedError) {
    super(normalized.message)
    this.name = 'HttpError'
    this.status = normalized.status ?? 0
    this.fields = normalized.fields
    this.raw = normalized.raw
  }
}

export interface HttpClient {
  request: <T = unknown>(req: HttpRequest) => Promise<T>
  get: <T = unknown>(path: string, req?: Omit<HttpRequest, 'path' | 'method'>) => Promise<T>
  post: <T = unknown>(path: string, body?: unknown, req?: Omit<HttpRequest, 'path' | 'method' | 'body'>) => Promise<T>
}

export function joinUrl(baseUrl: string | undefined, path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  if (!baseUrl) return path
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

/** Append query values, skipping `undefined`/`null` and flattening arrays. */
export function appendQuery(url: string, query: Record<string, unknown> | undefined): string {
  if (!query) return url
  const [base, existing] = url.split('?')
  const params = new URLSearchParams(existing ?? '')
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === '') continue
    if (Array.isArray(value)) {
      for (const v of value) if (v != null) params.append(key, toText(v))
    } else {
      // `toText`, not `String`: a filter whose value is an object would
      // otherwise be sent as the literal text "[object Object]".
      params.set(key, toText(value))
    }
  }
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const doFetch = options.fetch ?? globalThis.fetch
  const authHeader = options.authHeader ?? { name: 'Authorization', prefix: 'Bearer ' }

  // Single-flight: a page that fires six requests on mount and gets six 401s
  // must refresh once, not six times.
  let refreshing: Promise<boolean> | null = null
  function refreshOnce(): Promise<boolean> {
    if (!options.onUnauthorized) return Promise.resolve(false)
    refreshing ??= options.onUnauthorized().finally(() => {
      refreshing = null
    })
    return refreshing
  }

  async function buildHeaders(req: HttpRequest): Promise<Record<string, string>> {
    const extra = typeof options.headers === 'function' ? await options.headers() : options.headers
    const headers: Record<string, string> = { Accept: 'application/json', ...extra, ...req.headers }
    if (req.body !== undefined && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json'
    }
    const token = await options.getToken?.()
    if (token) headers[authHeader.name] = `${authHeader.prefix ?? ''}${token}`
    return headers
  }

  async function send<T>(req: HttpRequest, isRetry: boolean): Promise<T> {
    if (!doFetch) throw new HttpError({ message: 'No fetch implementation available', status: 0 })

    const url = appendQuery(joinUrl(options.baseUrl, req.path), req.query)
    const res = await doFetch(url, {
      method: req.method ?? 'GET',
      headers: await buildHeaders(req),
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
      credentials: options.credentials ?? 'include',
      signal: req.signal,
    })

    if (res.status === 401 && !isRetry && !req.noRetry) {
      if (await refreshOnce()) return send<T>(req, true)
    }

    if (!res.ok) throw new HttpError(await normalizeError(res, options.mapError))

    if (res.status === 204) return undefined as T
    const text = await res.text()
    if (!text) return undefined as T
    try {
      return JSON.parse(text) as T
    } catch {
      // A 200 that isn't JSON is a real answer to some endpoints; hand it back.
      return text as unknown as T
    }
  }

  const request = <T,>(req: HttpRequest) => send<T>(req, false)

  return {
    request,
    get: (path, req) => request({ ...req, path, method: 'GET' }),
    post: (path, body, req) => request({ ...req, path, method: 'POST', body }),
  }
}

async function normalizeError(
  res: Response,
  mapError: HttpClientOptions['mapError'],
): Promise<NormalizedError> {
  const text = await res.text().catch(() => '')
  let raw: unknown = text
  try {
    raw = text ? JSON.parse(text) : null
  } catch {
    /* leave it as text */
  }

  if (mapError) return { status: res.status, ...mapError(raw, res.status) }

  const o = (raw ?? {}) as Record<string, unknown>
  const message =
    pickString(o.message) ??
    pickString(o.error) ??
    pickString(o.detail) ??
    (text ? text.slice(0, 300) : `Request failed (${res.status})`)

  const fields =
    (isRecord(o.errors) ? (o.errors as Record<string, string | string[]>) : undefined) ??
    (isRecord(o.fields) ? (o.fields as Record<string, string | string[]>) : undefined)

  return { message, status: res.status, fields, raw }
}

function pickString(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
