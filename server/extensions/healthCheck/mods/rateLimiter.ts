// In-memory rate limiter for on-demand probe endpoints.
// Keyed by an arbitrary string (healthCheckId or boardId), enforces a minimum
// interval between successive calls. State is lost on process restart — this is
// intentional (rate limiting is a best-effort, per-process guard).

const RATE_LIMIT_WINDOW_MS = 5_000; // 5 seconds between probes for the same key

// Map<key, lastCallTimestamp>
const lastCallAt = new Map<string, number>();

/**
 * Returns true when the caller should be allowed to proceed, and records the
 * current timestamp so subsequent calls within the window are rejected.
 * Returns false when a call for `key` was made within the last 5 seconds.
 */
export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const last = lastCallAt.get(key);
  if (last !== undefined && now - last < RATE_LIMIT_WINDOW_MS) {
    return false;
  }
  lastCallAt.set(key, now);
  return true;
}

/**
 * Returns the milliseconds remaining until `key` is allowed again, or 0 if
 * the key is not currently rate-limited.
 */
export function retryAfterMs(key: string): number {
  const now = Date.now();
  const last = lastCallAt.get(key);
  if (last === undefined) return 0;
  const remaining = RATE_LIMIT_WINDOW_MS - (now - last);
  return remaining > 0 ? remaining : 0;
}
