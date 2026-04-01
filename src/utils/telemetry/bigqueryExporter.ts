// [fast-code] telemetry disabled — no-op BigQuery exporter stub

import { type ExportResult, ExportResultCode } from '@opentelemetry/core'
import {
  AggregationTemporality,
  type PushMetricExporter,
  type ResourceMetrics,
} from '@opentelemetry/sdk-metrics'

export class BigQueryMetricsExporter implements PushMetricExporter {
  constructor(_options: { timeout?: number } = {}) {
    // [fast-code] telemetry disabled
  }

  async export(
    _metrics: ResourceMetrics,
    resultCallback: (result: ExportResult) => void,
  ): Promise<void> {
    // [fast-code] telemetry disabled
    resultCallback({ code: ExportResultCode.SUCCESS })
  }

  async shutdown(): Promise<void> {
    // [fast-code] telemetry disabled
  }

  async forceFlush(): Promise<void> {
    // [fast-code] telemetry disabled
  }

  selectAggregationTemporality(): AggregationTemporality {
    return AggregationTemporality.DELTA
  }
}
