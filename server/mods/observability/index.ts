// server/mods/observability/index.ts
// Entry point — initialises tracer and metrics once at server boot.
// Both are fully gated by OTEL_ENABLED; calling this when disabled is safe.
import { initTracer } from './tracer';
import { initMetrics } from './metrics';

export { getTracer } from './tracer';
export { getMetrics } from './metrics';

export async function initObservability(): Promise<void> {
  await Promise.all([initTracer(), initMetrics()]);
}
