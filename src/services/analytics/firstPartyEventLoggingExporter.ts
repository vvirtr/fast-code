// [fast-code] telemetry disabled — no-op exporter stub
// Keeps the class signature so BatchLogRecordProcessor can instantiate it,
// but never sends HTTP, never writes to disk.

import { type ExportResult, ExportResultCode } from '@opentelemetry/core'
import type {
  LogRecordExporter,
  ReadableLogRecord,
} from '@opentelemetry/sdk-logs'

export class FirstPartyEventLoggingExporter implements LogRecordExporter {
  constructor(
    _options: {
      timeout?: number
      maxBatchSize?: number
      skipAuth?: boolean
      batchDelayMs?: number
      baseBackoffDelayMs?: number
      maxBackoffDelayMs?: number
      maxAttempts?: number
      path?: string
      baseUrl?: string
      isKilled?: () => boolean
      schedule?: (fn: () => Promise<void>, delayMs: number) => () => void
    } = {},
  ) {
    // [fast-code] telemetry disabled
  }

  async getQueuedEventCount(): Promise<number> {
    return 0
  }

  async export(
    _logs: ReadableLogRecord[],
    resultCallback: (result: ExportResult) => void,
  ): Promise<void> {
    // [fast-code] telemetry disabled — immediately report success
    resultCallback({ code: ExportResultCode.SUCCESS })
  }

  async shutdown(): Promise<void> {
    // [fast-code] telemetry disabled
  }

  async forceFlush(): Promise<void> {
    // [fast-code] telemetry disabled
  }
}
