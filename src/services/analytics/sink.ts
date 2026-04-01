// [fast-code] telemetry disabled — sink attaches a no-op implementation
// so logEvent / logEventAsync calls resolve immediately without HTTP or disk I/O.

import { attachAnalyticsSink } from './index.js'

// Local type matching the logEvent metadata signature
type LogEventMetadata = { [key: string]: boolean | number | undefined }

export function initializeAnalyticsGates(): void {
  // [fast-code] telemetry disabled
}

export function initializeAnalyticsSink(): void {
  // [fast-code] telemetry disabled — attach a no-op sink so queued events
  // drain harmlessly and future logEvent() calls are immediate no-ops.
  attachAnalyticsSink({
    logEvent: (_eventName: string, _metadata: LogEventMetadata): void => {},
    logEventAsync: (
      _eventName: string,
      _metadata: LogEventMetadata,
    ): Promise<void> => Promise.resolve(),
  })
}
