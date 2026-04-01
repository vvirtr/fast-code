// [fast-code] telemetry disabled — all exports are no-op stubs

import { memoize } from '../../utils/lodashNative.js'

export const initializeDatadog = memoize(async (): Promise<boolean> => {
  // [fast-code] telemetry disabled
  return false
})

export async function shutdownDatadog(): Promise<void> {
  // [fast-code] telemetry disabled
}

// NOTE: use via src/services/analytics/index.ts > logEvent
export async function trackDatadogEvent(
  _eventName: string,
  _properties: { [key: string]: boolean | number | undefined },
): Promise<void> {
  // [fast-code] telemetry disabled
}
