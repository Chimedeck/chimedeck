// tests/integration/otel.test.ts
// Verifies OTEL initialisation behaviour.
import { describe, it, expect } from 'bun:test';
import { getTracer, isInitialized, initTracer } from '../../server/mods/observability/tracer';
import { getMetrics, initMetrics } from '../../server/mods/observability/metrics';

describe('OTEL tracer — OTEL_ENABLED=false (default in tests)', () => {
  it('initTracer resolves without throwing when OTEL_ENABLED=false', async () => {
    await expect(initTracer()).resolves.toBeUndefined();
  });

  it('isInitialized returns false when OTEL_ENABLED=false', async () => {
    await initTracer();
    expect(isInitialized()).toBe(false);
  });

  it('getTracer returns a no-op tracer that does not throw', () => {
    const tracer = getTracer();
    expect(tracer).toBeDefined();
    const span = tracer.startSpan('test-span', { key: 'value' });
    expect(span).toBeDefined();
    span.setAttribute('foo', 'bar');
    span.setStatus({ code: 0 });
    span.end(); // must not throw
  });
});

describe('OTEL metrics — OTEL_ENABLED=false (default in tests)', () => {
  it('initMetrics resolves without throwing when OTEL_ENABLED=false', async () => {
    await expect(initMetrics()).resolves.toBeUndefined();
  });

  it('getMetrics returns no-op counters/histograms that do not throw', async () => {
    await initMetrics();
    const metrics = getMetrics();
    expect(metrics).toBeDefined();

    // All calls must be safe no-ops.
    expect(() => metrics.mutationLatencyMs.record(42, { route: 'test' })).not.toThrow();
    expect(() => metrics.syncDelayMs.record(10)).not.toThrow();
    expect(() => metrics.httpErrorTotal.add(1, { status: '500' })).not.toThrow();
    expect(() => metrics.conflictTotal.add(1)).not.toThrow();
    expect(() => metrics.wsDisconnectTotal.add(1)).not.toThrow();
  });
});
