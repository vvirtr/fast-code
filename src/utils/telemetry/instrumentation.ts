// [fast-code] telemetry disabled — all OTEL initialization stubbed out.
// Exported function signatures preserved so callers compile.

import {
  resourceFromAttributes,
} from '@opentelemetry/resources'
import {
  MeterProvider,
} from '@opentelemetry/sdk-metrics'
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions'
import {
  setMeterProvider,
} from 'src/bootstrap/state.js'

export function bootstrapTelemetry() {
  // [fast-code] telemetry disabled
}

export function parseExporterTypes(_value: string | undefined): string[] {
  // [fast-code] telemetry disabled
  return []
}

export function isTelemetryEnabled() {
  // [fast-code] telemetry disabled — always false
  return false
}

export async function initializeTelemetry() {
  // [fast-code] telemetry disabled — create a bare MeterProvider with no
  // readers/exporters so callers that expect a Meter still work.
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'claude-code',
    [ATTR_SERVICE_VERSION]: MACRO.VERSION,
  })

  const meterProvider = new MeterProvider({
    resource,
    views: [],
    readers: [],
  })

  setMeterProvider(meterProvider)

  return meterProvider.getMeter('com.anthropic.claude_code', MACRO.VERSION)
}

export async function flushTelemetry(): Promise<void> {
  // [fast-code] telemetry disabled
}
