/**
 * Async wrapper that offloads session JSONL I/O + parsing to a Worker thread.
 *
 * On Bun: spawns a persistent singleton Worker running sessionLoadWorker.ts.
 * Elsewhere (or on error): falls back to the synchronous-on-main-thread path
 * via loadTranscriptIOAndParse directly.
 *
 * The Worker is created lazily on first call and reused for all subsequent
 * loads. Requests are serialized — only one load runs in the Worker at a time
 * — because the Worker is single-threaded and pipelining would just queue
 * inside it anyway.
 */

import { parseJSONL } from './json.js'
import type {
  SessionLoadError,
  SessionLoadRequest,
  SessionLoadResponse,
} from './sessionLoadWorker.js'
import { loadTranscriptIOAndParse } from './sessionStoragePortable.js'

// ---------------------------------------------------------------------------
// Result type (plain arrays, structured-clone safe)
// ---------------------------------------------------------------------------

export interface SessionLoadResult<T> {
  entries: T[]
  metaEntries: T[]
  hasPreservedSegment: boolean
}

// ---------------------------------------------------------------------------
// Worker singleton
// ---------------------------------------------------------------------------

let worker: Worker | null = null
let workerFailed = false

/**
 * Pending request state. Only one request is in flight at a time; subsequent
 * callers wait via the queue.
 */
let pendingResolve: ((value: SessionLoadResponse | SessionLoadError) => void) | null = null
const requestQueue: Array<{
  request: SessionLoadRequest
  resolve: (value: SessionLoadResponse | SessionLoadError) => void
}> = []

function getWorker(): Worker | null {
  if (workerFailed) return null
  if (worker) return worker

  // Only available in Bun
  if (typeof Worker === 'undefined') {
    workerFailed = true
    return null
  }

  try {
    const w = new Worker(new URL('./sessionLoadWorker.js', import.meta.url), {
      type: 'module',
    })

    w.addEventListener(
      'message',
      (event: MessageEvent<SessionLoadResponse | SessionLoadError>) => {
        const resolve = pendingResolve
        pendingResolve = null
        if (resolve) {
          resolve(event.data)
        }
        // Process next queued request
        drainQueue(w)
      },
    )

    w.addEventListener('error', (err: ErrorEvent) => {
      // Worker crashed — resolve the pending request with an error and
      // mark the worker as failed so future calls use the fallback.
      const resolve = pendingResolve
      pendingResolve = null
      workerFailed = true
      worker = null

      if (resolve) {
        resolve({ ok: false, error: err.message ?? 'Worker error' })
      }

      // Drain remaining queue with errors
      while (requestQueue.length > 0) {
        const queued = requestQueue.shift()!
        queued.resolve({ ok: false, error: 'Worker terminated' })
      }
    })

    worker = w
    return w
  } catch {
    workerFailed = true
    return null
  }
}

function drainQueue(w: Worker): void {
  if (requestQueue.length === 0) return
  const next = requestQueue.shift()!
  pendingResolve = next.resolve
  w.postMessage(next.request)
}

function sendToWorker(
  w: Worker,
  request: SessionLoadRequest,
): Promise<SessionLoadResponse | SessionLoadError> {
  return new Promise(resolve => {
    if (pendingResolve !== null) {
      // Another request is in flight — queue this one
      requestQueue.push({ request, resolve })
    } else {
      pendingResolve = resolve
      w.postMessage(request)
    }
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load and parse a session JSONL file, offloading to a Worker when available.
 *
 * Returns the same result shape as the inline I/O+parse pipeline in
 * loadTranscriptFile, but runs the heavy work off the main thread.
 *
 * Falls back to main-thread execution when:
 *   - Workers are not available (non-Bun environment)
 *   - The Worker failed to spawn or crashed
 */
export async function loadTranscriptAsync<T>(
  filePath: string,
  disablePrecompactSkip: boolean,
  keepAllLeaves: boolean,
): Promise<SessionLoadResult<T>> {
  const w = getWorker()
  if (w) {
    const request: SessionLoadRequest = {
      filePath,
      disablePrecompactSkip,
      keepAllLeaves,
    }
    const response = await sendToWorker(w, request)
    if (response.ok) {
      return {
        entries: response.entries as T[],
        metaEntries: response.metaEntries as T[],
        hasPreservedSegment: response.hasPreservedSegment,
      }
    }
    // Worker returned an error — fall through to synchronous path
  }

  // Fallback: run on the main thread
  return loadTranscriptIOAndParse<T>(
    filePath,
    disablePrecompactSkip,
    keepAllLeaves,
    parseJSONL,
  )
}

/**
 * Terminate the worker if it exists. Useful for clean shutdown.
 */
export function terminateSessionLoadWorker(): void {
  if (worker) {
    worker.terminate()
    worker = null
  }
}
