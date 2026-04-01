// [fast-code] telemetry disabled — all exports are no-op stubs.
// Function signatures preserved so compile-time consumers don't break.

import type { GrowthBookUserAttributes } from './growthbook.js'

export type EventSamplingConfig = {
  [eventName: string]: {
    sample_rate: number
  }
}

export function getEventSamplingConfig(): EventSamplingConfig {
  // [fast-code] telemetry disabled
  return {}
}

export function shouldSampleEvent(_eventName: string): number | null {
  // [fast-code] telemetry disabled — drop everything
  return 0
}

export async function shutdown1PEventLogging(): Promise<void> {
  // [fast-code] telemetry disabled
}

export function is1PEventLoggingEnabled(): boolean {
  // [fast-code] telemetry disabled
  return false
}

export function logEventTo1P(
  _eventName: string,
  _metadata: Record<string, number | boolean | undefined> = {},
): void {
  // [fast-code] telemetry disabled
}

export type GrowthBookExperimentData = {
  experimentId: string
  variationId: number
  userAttributes?: GrowthBookUserAttributes
  experimentMetadata?: Record<string, unknown>
}

export function logGrowthBookExperimentTo1P(
  _data: GrowthBookExperimentData,
): void {
  // [fast-code] telemetry disabled
}

export function initialize1PEventLogging(): void {
  // [fast-code] telemetry disabled
}

export async function reinitialize1PEventLoggingIfConfigChanged(): Promise<void> {
  // [fast-code] telemetry disabled
}
