// HTTP probe with 10-second timeout and SSRF guard.
// Resolves the target hostname via DNS before fetching to block private IP ranges.
import { lookup } from 'node:dns/promises';
import { classify, type ProbeStatus } from './classify';
import { healthCheckConfig } from '../../common/config/healthCheck';

export interface ProbeResult {
  status: ProbeStatus;
  httpStatus: number | null;
  responseTimeMs: number | null;
  errorMessage: string | null;
  checkedAt: string;
}

// IPv4 and IPv6 private/reserved ranges blocked to prevent SSRF.
const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^10\./,                         // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./,   // 172.16.0.0/12
  /^192\.168\./,                   // 192.168.0.0/16
  /^127\./,                        // 127.0.0.0/8 loopback
  /^169\.254\./,                   // 169.254.0.0/16 link-local
  /^0\./,                          // 0.0.0.0/8
  /^::1$/,                         // IPv6 loopback
  /^fc[0-9a-f]{2}:/i,              // fc00::/7 ULA
  /^fd[0-9a-f]{2}:/i,              // fd00::/8 ULA
  /^fe80:/i,                       // fe80::/10 link-local
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(ip));
}

export class SsrfError extends Error {
  constructor(hostname: string) {
    super(`SSRF guard blocked probe to private host: ${hostname}`);
    this.name = 'SsrfError';
  }
}

/**
 * Resolve the hostname via DNS and throw SsrfError if the resolved address
 * falls within a private/reserved IP range or is a known private hostname.
 */
async function assertPublicHost(hostname: string): Promise<void> {
  const lower = hostname.toLowerCase();

  // Block well-known private hostnames without a DNS round-trip
  if (lower === 'localhost' || lower.endsWith('.local') || lower.endsWith('.internal')) {
    throw new SsrfError(hostname);
  }

  const { address } = await lookup(hostname);
  if (isPrivateIp(address)) {
    throw new SsrfError(hostname);
  }
}

/**
 * Perform an HTTP GET probe against `url`.
 * - Enforces SSRF guard (DNS pre-check).
 * - Enforces configurable timeout (default 10 s).
 * - Returns a ProbeResult including status classification.
 */
export async function runProbe({ url }: { url: string }): Promise<ProbeResult> {
  const { timeoutMs, amberThresholdMs } = healthCheckConfig;
  const checkedAt = new Date().toISOString();

  // Parse URL — reject malformed inputs immediately
  let hostname: string;
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname;
  } catch {
    return {
      status: 'red',
      httpStatus: null,
      responseTimeMs: null,
      errorMessage: 'Invalid URL',
      checkedAt,
    };
  }

  // SSRF guard — DNS pre-check before making any outbound request
  try {
    await assertPublicHost(hostname);
  } catch (err) {
    if (err instanceof SsrfError) {
      return {
        status: 'red',
        httpStatus: null,
        responseTimeMs: null,
        errorMessage: err.message,
        checkedAt,
      };
    }
    return {
      status: 'red',
      httpStatus: null,
      responseTimeMs: null,
      errorMessage: `DNS resolution failed: ${(err as Error).message}`,
      checkedAt,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startTime = Date.now();

  try {
    // follow redirects so we measure end-to-end reachability;
    // use response.redirected to detect that a 3xx was followed (classify as amber)
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
    });
    const responseTimeMs = Date.now() - startTime;

    // If fetch silently followed a redirect, treat the original response as 3xx → amber
    const httpStatus = response.redirected ? 301 : response.status;

    const status = classify({ httpStatus, responseTimeMs, error: null, amberThresholdMs });
    return { status, httpStatus, responseTimeMs, errorMessage: null, checkedAt };
  } catch (err) {
    const responseTimeMs = Date.now() - startTime;
    const isTimeout = (err as Error).name === 'AbortError';
    const errorMessage = isTimeout
      ? `Timeout after ${responseTimeMs}ms`
      : (err as Error).message;

    return {
      status: 'red',
      httpStatus: null,
      // Preserve timing for timeouts so callers can see how long it waited
      responseTimeMs: isTimeout ? responseTimeMs : null,
      errorMessage,
      checkedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}
