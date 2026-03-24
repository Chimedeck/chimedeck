// URL validation for health check entries.
// Enforces scheme allow-list, blocks credentials in URL, and rejects private/SSRF-risky targets.
// This runs at POST time (before any DNS resolution or HTTP request is made).

export class UrlValidationError extends Error {
  // `name` shadows Error.name — `override` required by strict TS settings.
  public override readonly name: string;

  constructor(name: string, message: string) {
    super(message);
    this.name = name;
  }
}

// Private IPv4 CIDR blocks that must be rejected (SSRF prevention).
const PRIVATE_IPV4_RANGES = [
  // 10.0.0.0/8
  (parts: number[]) => parts[0] === 10,
  // 172.16.0.0/12
  (parts: number[]) => parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31,
  // 192.168.0.0/16
  (parts: number[]) => parts[0] === 192 && parts[1] === 168,
  // 127.0.0.0/8 — loopback
  (parts: number[]) => parts[0] === 127,
  // 169.254.0.0/16 — link-local (AWS metadata)
  (parts: number[]) => parts[0] === 169 && parts[1] === 254,
];

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return false;
  return PRIVATE_IPV4_RANGES.some((check) => check(parts));
}

function isPrivateIpv6(hostname: string): boolean {
  // Strip brackets from IPv6 literal (e.g. [::1])
  const raw = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  // Loopback ::1
  if (raw === '::1') return true;
  // Loopback 0:0:0:0:0:0:0:1
  if (raw === '0:0:0:0:0:0:0:1') return true;
  // fc00::/7 — unique local addresses (fc00:: through fdff::)
  const lower = raw.toLowerCase();
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  // fe80::/10 — link-local
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
  return false;
}

/**
 * Validates that a URL is safe for use as a health check target.
 *
 * Throws UrlValidationError with a structured `name` on any violation.
 * Returns the parsed URL on success.
 */
export function validateUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new UrlValidationError('health-check-url-invalid', 'URL is not a valid absolute URL');
  }

  // Scheme allow-list: only http and https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UrlValidationError(
      'health-check-url-invalid-scheme',
      'Only http and https URLs are allowed',
    );
  }

  // Reject credentials embedded in the URL (user:password@host)
  if (parsed.username || parsed.password) {
    throw new UrlValidationError(
      'health-check-url-credentials-not-allowed',
      'Credentials in the URL are not permitted',
    );
  }

  const hostname = parsed.hostname;

  // Reject localhost and .local hostnames
  if (hostname === 'localhost' || hostname.endsWith('.local')) {
    throw new UrlValidationError(
      'health-check-url-ssrf-rejected',
      'Private or local hostnames are not allowed',
    );
  }

  // Reject private IPv4 ranges
  if (isPrivateIpv4(hostname)) {
    throw new UrlValidationError(
      'health-check-url-ssrf-rejected',
      'Private IP addresses are not allowed',
    );
  }

  // Reject private/loopback IPv6 addresses
  if (isPrivateIpv6(hostname)) {
    throw new UrlValidationError(
      'health-check-url-ssrf-rejected',
      'Private IP addresses are not allowed',
    );
  }

  return parsed;
}
