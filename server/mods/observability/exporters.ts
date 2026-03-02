// server/mods/observability/exporters.ts
// OTLP HTTP exporter configuration.
// Actual @opentelemetry/exporter-trace-otlp-http export used when OTEL_ENABLED=true.
// Install: bun add @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-metrics-otlp-http
import { env } from '../../config/env';

export interface OtlpExporterConfig {
  url: string;
  headers?: Record<string, string>;
}

export function getExporterConfig(): OtlpExporterConfig {
  return {
    url: env.OTEL_EXPORTER_URL,
    headers: {},
  };
}
