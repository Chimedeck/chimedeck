// Probe pipeline: runProbe → persistResult.
// Composes the two stages so callers invoke a single function per health check entry.
import { runProbe } from './runProbe';
import { persistResult, type PersistedProbeResult } from './persistResult';

export type { ProbeResult } from './runProbe';
export type { PersistedProbeResult } from './persistResult';
export { SsrfError } from './runProbe';
export { classify } from './classify';

/**
 * Run an HTTP probe against `url`, classify the result, and persist it.
 * Returns the stored row so it can be embedded in API responses immediately.
 */
export async function probe({
  healthCheckId,
  url,
}: {
  healthCheckId: string;
  url: string;
}): Promise<PersistedProbeResult> {
  const result = await runProbe({ url });
  return persistResult({ healthCheckId, result });
}
