// server/mods/observability/metrics.ts
// OpenTelemetry metrics — counters and histograms.
// Gated by OTEL_ENABLED. All calls are no-ops when disabled.
// Install: bun add @opentelemetry/sdk-metrics @opentelemetry/api @opentelemetry/exporter-metrics-otlp-http
import { env } from '../../config/env';
import { getExporterConfig } from './exporters';

export interface Counter {
  add(value: number, attributes?: Record<string, string>): void;
}

export interface Histogram {
  record(value: number, attributes?: Record<string, string>): void;
}

const noopCounter: Counter = { add: () => {} };
const noopHistogram: Histogram = { record: () => {} };

interface Metrics {
  mutationLatencyMs: Histogram;
  syncDelayMs: Histogram;
  httpErrorTotal: Counter;
  conflictTotal: Counter;
  wsDisconnectTotal: Counter;
}

const noop: Metrics = {
  mutationLatencyMs: noopHistogram,
  syncDelayMs: noopHistogram,
  httpErrorTotal: noopCounter,
  conflictTotal: noopCounter,
  wsDisconnectTotal: noopCounter,
};

let _metrics: Metrics = noop;

export function getMetrics(): Metrics {
  return _metrics;
}

export async function initMetrics(): Promise<void> {
  if (!env.OTEL_ENABLED) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { MeterProvider, PeriodicExportingMetricReader } = await import('@opentelemetry/sdk-metrics' as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { OTLPMetricExporter } = await import('@opentelemetry/exporter-metrics-otlp-http' as any);

    const exporterConfig = getExporterConfig();
    const exporter = new OTLPMetricExporter({ url: exporterConfig.url.replace('/v1/traces', '/v1/metrics') });
    const meterProvider = new MeterProvider({
      readers: [new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 10_000 })],
    });

    const meter = meterProvider.getMeter('kanban-server', '1.0.0');

    _metrics = {
      mutationLatencyMs: meter.createHistogram('mutation_latency_ms', {
        description: 'Latency of POST/PATCH/DELETE handlers in milliseconds',
        unit: 'ms',
      }),
      syncDelayMs: meter.createHistogram('sync_delay_ms', {
        description: 'WS event propagation delay: sent timestamp - Event.createdAt',
        unit: 'ms',
      }),
      httpErrorTotal: meter.createCounter('http_error_total', {
        description: 'HTTP error responses by status code and route',
      }),
      conflictTotal: meter.createCounter('conflict_total', {
        description: 'Position collision resolutions',
      }),
      wsDisconnectTotal: meter.createCounter('ws_disconnect_total', {
        description: 'WebSocket client disconnections',
      }),
    };

    console.info('[otel] MeterProvider initialised');
  } catch (err) {
    console.warn('[otel] Failed to initialise metrics — running without metrics:', err);
  }
}
