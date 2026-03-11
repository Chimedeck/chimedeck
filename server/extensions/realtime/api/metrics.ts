// server/extensions/realtime/api/metrics.ts
// POST /api/v1/metrics/propagation — client pings this after receiving a WS event
// to record the round-trip propagation delay in the realtime.propagation_delay_ms histogram.
// Only records when OTEL_ENABLED=true; responds 204 regardless to avoid errors on client.
import { env } from '../../../config/env';
import { getMetrics } from '../../../mods/observability/index';

export async function handlePropagationPing(req: Request): Promise<Response> {
  if (req.method !== 'POST') return null as unknown as Response;

  if (env.OTEL_ENABLED) {
    let body: { delayMs?: unknown } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return Response.json({ error: { name: 'invalid-json' } }, { status: 400 });
    }

    const delayMs = typeof body.delayMs === 'number' ? body.delayMs : null;
    if (delayMs === null || delayMs < 0) {
      return Response.json({ error: { name: 'invalid-delay-ms' } }, { status: 400 });
    }

    getMetrics().realtimePropagationDelayMs.record(delayMs);
    // Also record in the legacy syncDelayMs histogram so existing dashboards still work
    getMetrics().syncDelayMs.record(delayMs);
  }

  return new Response(null, { status: 204 });
}
