/**
 * Thin wrapper around native fetch() that provides axios-compatible response
 * shapes and error handling.  Eliminates the 225KB eager-loaded axios + mime-db
 * dependency.
 *
 * Key differences from raw fetch:
 *  - Throws HttpError on non-2xx responses (unless validateStatus overrides)
 *  - `response.data` is pre-parsed (json / text / arraybuffer based on responseType)
 *  - Supports `timeout`, `params`, `maxContentLength`, `maxRedirects` options
 *  - HttpError carries `.response`, `.code`, `.isHttpError` for downstream
 *    classifiers (classifyAxiosError still works via the duck-typed `.isAxiosError`
 *    property for backwards compat)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HttpResponse<T = unknown> {
  status: number
  statusText: string
  headers: Headers
  data: T
  config: { url?: string }
}

export interface HttpRequestConfig {
  headers?: Record<string, string>
  timeout?: number
  signal?: AbortSignal
  params?: Record<string, string | number | undefined>
  responseType?: 'json' | 'text' | 'arraybuffer'
  maxContentLength?: number
  maxRedirects?: number
  /** Return true to treat a status as success (no throw).  Default: 2xx. */
  validateStatus?: (status: number) => boolean
  /** dns lookup override — ignored by fetch (kept for API compat). */
  lookup?: unknown
}

/**
 * Error thrown when the server returns a status that validateStatus rejects.
 * Carries the same shape properties that classifyAxiosError / describeAxiosError
 * inspect (`.isAxiosError`, `.response.status`, `.response.data`, `.code`,
 * `.config.url`).
 */
export class HttpError extends Error {
  /** Backwards-compat flag checked by classifyAxiosError in utils/errors.ts */
  readonly isAxiosError = true
  readonly isHttpError = true
  response?: {
    status: number
    statusText: string
    headers: Headers
    data: unknown
  }
  code?: string
  config: { url?: string }

  constructor(
    message: string,
    opts?: {
      response?: HttpError['response']
      code?: string
      url?: string
      cause?: unknown
    },
  ) {
    super(message)
    this.name = 'HttpError'
    this.response = opts?.response
    this.code = opts?.code
    this.config = { url: opts?.url }
    if (opts?.cause) {
      this.cause = opts.cause
    }
  }
}

/**
 * Type-guard matching the shape of HttpError (duck-typed so it also matches
 * legacy AxiosError objects that may still be in flight during migration).
 */
export function isHttpError(e: unknown): e is HttpError {
  return (
    e instanceof HttpError ||
    (!!e &&
      typeof e === 'object' &&
      ('isHttpError' in e || 'isAxiosError' in e))
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildUrl(
  url: string,
  params?: Record<string, string | number | undefined>,
): string {
  if (!params) return url
  const u = new URL(url)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) u.searchParams.set(k, String(v))
  }
  return u.toString()
}

function mergeSignals(
  signal?: AbortSignal,
  timeoutMs?: number,
): AbortSignal | undefined {
  if (!timeoutMs && !signal) return undefined
  if (!timeoutMs) return signal
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  if (!signal) return timeoutSignal
  // Combine: abort when either fires
  return AbortSignal.any([signal, timeoutSignal])
}

function defaultValidateStatus(status: number): boolean {
  return status >= 200 && status < 300
}

async function parseBody<T>(
  response: Response,
  responseType?: 'json' | 'text' | 'arraybuffer',
): Promise<T> {
  switch (responseType) {
    case 'arraybuffer':
      return (await response.arrayBuffer()) as T
    case 'text':
      return (await response.text()) as T
    default: {
      // Auto-detect: try JSON first based on content-type, fall back to text
      const ct = response.headers.get('content-type') ?? ''
      if (ct.includes('application/json') || responseType === 'json') {
        const text = await response.text()
        try {
          return JSON.parse(text) as T
        } catch {
          return text as T
        }
      }
      return (await response.text()) as T
    }
  }
}

// ---------------------------------------------------------------------------
// Core request function
// ---------------------------------------------------------------------------

async function request<T = unknown>(
  method: string,
  url: string,
  body?: unknown,
  config: HttpRequestConfig = {},
): Promise<HttpResponse<T>> {
  const {
    headers,
    timeout,
    signal,
    params,
    responseType,
    maxContentLength: _maxContentLength,
    maxRedirects,
    validateStatus = defaultValidateStatus,
  } = config

  const fullUrl = buildUrl(url, params)
  const combinedSignal = mergeSignals(signal, timeout)

  const fetchInit: RequestInit = {
    method: method.toUpperCase(),
    headers,
    signal: combinedSignal,
    redirect: maxRedirects === 0 ? 'manual' : 'follow',
  }

  if (body !== undefined && body !== null) {
    if (body instanceof ArrayBuffer || body instanceof Uint8Array) {
      fetchInit.body = body as ArrayBuffer
    } else if (typeof body === 'string') {
      fetchInit.body = body
    } else {
      fetchInit.body = JSON.stringify(body)
      // Set Content-Type if not already specified
      if (headers && !Object.keys(headers).some(k => k.toLowerCase() === 'content-type')) {
        ;(fetchInit.headers as Record<string, string>)['Content-Type'] = 'application/json'
      } else if (!headers) {
        fetchInit.headers = { 'Content-Type': 'application/json' }
      }
    }
  }

  let response: Response
  try {
    response = await fetch(fullUrl, fetchInit)
  } catch (err) {
    // Map network / abort errors to HttpError with appropriate codes
    const e = err as Error
    let code = 'ERR_NETWORK'
    if (e.name === 'AbortError' || e.name === 'TimeoutError') {
      code = 'ECONNABORTED'
    } else if (
      e.message?.includes('ECONNREFUSED') ||
      ('code' in e && (e as NodeJS.ErrnoException).code === 'ECONNREFUSED')
    ) {
      code = 'ECONNREFUSED'
    } else if (
      e.message?.includes('ENOTFOUND') ||
      ('code' in e && (e as NodeJS.ErrnoException).code === 'ENOTFOUND')
    ) {
      code = 'ENOTFOUND'
    } else if (
      e.message?.includes('ECONNRESET') ||
      ('code' in e && (e as NodeJS.ErrnoException).code === 'ECONNRESET')
    ) {
      code = 'ECONNRESET'
    }
    throw new HttpError(e.message ?? 'Network error', {
      code,
      url: fullUrl,
      cause: err,
    })
  }

  // For manual redirect mode, synthesise an HttpError with the redirect info
  // so callers handling redirects can inspect location headers.
  if (
    maxRedirects === 0 &&
    [301, 302, 307, 308].includes(response.status)
  ) {
    const data = (await parseBody(response, responseType)) as T
    if (!validateStatus(response.status)) {
      throw new HttpError(
        `Request failed with status code ${response.status}`,
        {
          response: {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data,
          },
          url: fullUrl,
        },
      )
    }
    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data,
      config: { url: fullUrl },
    }
  }

  const data = (await parseBody(response, responseType)) as T

  if (!validateStatus(response.status)) {
    throw new HttpError(
      `Request failed with status code ${response.status}`,
      {
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data,
        },
        url: fullUrl,
      },
    )
  }

  return {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    data,
    config: { url: fullUrl },
  }
}

// ---------------------------------------------------------------------------
// Public convenience methods (mirror axios.get / .post / .put / etc.)
// ---------------------------------------------------------------------------

export const httpGet = <T = unknown>(
  url: string,
  config?: HttpRequestConfig,
): Promise<HttpResponse<T>> => request<T>('GET', url, undefined, config)

export const httpPost = <T = unknown>(
  url: string,
  body?: unknown,
  config?: HttpRequestConfig,
): Promise<HttpResponse<T>> => request<T>('POST', url, body, config)

export const httpPut = <T = unknown>(
  url: string,
  body?: unknown,
  config?: HttpRequestConfig,
): Promise<HttpResponse<T>> => request<T>('PUT', url, body, config)

export const httpPatch = <T = unknown>(
  url: string,
  body?: unknown,
  config?: HttpRequestConfig,
): Promise<HttpResponse<T>> => request<T>('PATCH', url, body, config)

export const httpDelete = <T = unknown>(
  url: string,
  config?: HttpRequestConfig,
): Promise<HttpResponse<T>> => request<T>('DELETE', url, undefined, config)

export const httpHead = <T = unknown>(
  url: string,
  config?: HttpRequestConfig,
): Promise<HttpResponse<T>> => request<T>('HEAD', url, undefined, config)

export const httpRequest = <T = unknown>(opts: {
  method: string
  url: string
  headers?: Record<string, string>
  data?: unknown
  timeout?: number
  signal?: AbortSignal
  validateStatus?: (status: number) => boolean
}): Promise<HttpResponse<T>> =>
  request<T>(opts.method, opts.url, opts.data, {
    headers: opts.headers,
    timeout: opts.timeout,
    signal: opts.signal,
    validateStatus: opts.validateStatus,
  })
