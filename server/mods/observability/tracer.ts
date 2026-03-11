// server/mods/observability/tracer.ts
// OpenTelemetry tracer — gated by OTEL_ENABLED.
// When disabled, all operations are no-ops so call sites remain unchanged.
// To enable: set OTEL_ENABLED=true and install @opentelemetry/sdk-trace-node,
// @opentelemetry/api, @opentelemetry/exporter-trace-otlp-http.
import { env } from '../../config/env';
import { getExporterConfig } from './exporters';

export interface Span {
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(status: { code: number; message?: string }): void;
  recordException(err: unknown): void;
  end(): void;
}

export interface Tracer {
  startSpan(name: string, attributes?: Record<string, string | number | boolean>): Span;
}

// No-op implementations used when OTEL_ENABLED=false or SDK is unavailable.
const noopSpan: Span = {
  setAttribute: () => {},
  setStatus: () => {},
  recordException: () => {},
  end: () => {},
};

const noopTracer: Tracer = {
  startSpan: () => noopSpan,
};

let _tracer: Tracer = noopTracer;
let _initialized = false;

export function getTracer(): Tracer {
  return _tracer;
}

export function isInitialized(): boolean {
  return _initialized;
}

export async function initTracer(): Promise<void> {
  if (!env.OTEL_ENABLED) return;

  try {
    // Dynamic imports so tsc does not fail when packages are absent.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const otelApi = await import('@opentelemetry/api' as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { NodeTracerProvider, BatchSpanProcessor } = await import('@opentelemetry/sdk-trace-node' as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http' as any);

    const exporterConfig = getExporterConfig();
    const exporter = new OTLPTraceExporter(exporterConfig);
    const provider = new NodeTracerProvider({
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });
    provider.register();

    const rawTracer = otelApi.trace.getTracer('kanban-server', '1.0.0');

    _tracer = {
      startSpan(name: string, attributes?: Record<string, string | number | boolean>): Span {
        const span = rawTracer.startSpan(name);
        if (attributes) {
          for (const [k, v] of Object.entries(attributes)) {
            span.setAttribute(k, v);
          }
        }
        return span as unknown as Span;
      },
    };

    _initialized = true;
    console.info('[otel] TracerProvider initialised → exporting to', exporterConfig.url);
  } catch (err) {
    console.warn('[otel] Failed to initialise tracer — running without traces:', err);
  }
}
