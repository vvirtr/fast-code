/**
 * Bun Worker module for off-main-thread session JSONL loading.
 *
 * Receives a file path + config via postMessage, performs the heavy I/O and
 * parse pipeline (readTranscriptForLoad, scanPreBoundaryMetadata,
 * walkChainBeforeParse, parseJSONL), and posts back the parsed entries as
 * plain arrays (structured-clone safe).
 *
 * Only imported by sessionLoadAsync.ts — never by the main application code.
 */

import { parseJSONL } from './json.js'
import { loadTranscriptIOAndParse } from './sessionStoragePortable.js'

export interface SessionLoadRequest {
  filePath: string
  disablePrecompactSkip: boolean
  keepAllLeaves: boolean
}

export interface SessionLoadResponse {
  ok: true
  entries: unknown[]
  metaEntries: unknown[]
  hasPreservedSegment: boolean
}

export interface SessionLoadError {
  ok: false
  error: string
}

declare const self: Worker

self.addEventListener(
  'message',
  (event: MessageEvent<SessionLoadRequest>) => {
    const { filePath, disablePrecompactSkip, keepAllLeaves } = event.data
    loadTranscriptIOAndParse(
      filePath,
      disablePrecompactSkip,
      keepAllLeaves,
      parseJSONL,
    )
      .then(result => {
        const response: SessionLoadResponse = {
          ok: true,
          entries: result.entries,
          metaEntries: result.metaEntries,
          hasPreservedSegment: result.hasPreservedSegment,
        }
        self.postMessage(response)
      })
      .catch((err: unknown) => {
        const response: SessionLoadError = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }
        self.postMessage(response)
      })
  },
)
