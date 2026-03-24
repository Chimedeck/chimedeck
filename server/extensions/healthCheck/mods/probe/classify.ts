// Pure classifier: maps (httpStatus, responseTimeMs, error) → 'green' | 'amber' | 'red'.
// No side-effects, no I/O — safe to unit-test without mocking.

export type ProbeStatus = 'green' | 'amber' | 'red';

export interface ClassifyParams {
  httpStatus: number | null;
  responseTimeMs: number | null;
  /** Non-null when a network error, timeout, or SSRF rejection occurred. */
  error: string | null;
  /** Threshold in ms above which a 2xx response is classified amber. */
  amberThresholdMs: number;
}

/**
 * Classification rules (from sprint-115 spec):
 *   green  — HTTP 2xx AND responseTimeMs < amberThresholdMs
 *   amber  — HTTP 2xx but slow (>= threshold) OR HTTP 3xx (redirect but reachable)
 *   red    — HTTP 4xx / 5xx, timeout, network error, or DNS failure
 */
export function classify({
  httpStatus,
  responseTimeMs,
  error,
  amberThresholdMs,
}: ClassifyParams): ProbeStatus {
  // Any error (timeout, DNS failure, SSRF rejection) → red
  if (error !== null) return 'red';
  if (httpStatus === null) return 'red';

  // 4xx or 5xx → red
  if (httpStatus >= 400) return 'red';

  // 3xx redirect → amber (reachable but not settling at the requested URL)
  if (httpStatus >= 300) return 'amber';

  // 2xx — classify by response time
  if (httpStatus >= 200) {
    if (responseTimeMs !== null && responseTimeMs >= amberThresholdMs) return 'amber';
    return 'green';
  }

  // 1xx informational or unexpected status codes → red
  return 'red';
}
