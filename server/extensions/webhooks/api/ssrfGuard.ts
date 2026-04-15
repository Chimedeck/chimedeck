// [why] Prevents SSRF by blocking private/loopback/link-local IP ranges.
// All webhook endpoint URLs must use HTTPS — HTTP is rejected at this layer.
import dns from 'node:dns/promises';

// RFC-1918 private, loopback, link-local, and ULA ranges.
const BLOCKED_IP = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|::1$|fc00:|fd)/;

// Returns true when the URL is safe to dispatch to.
// Rejects non-https scheme and any endpoint whose resolved IP falls in a private range.
export async function isEndpointAllowed(raw: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;

  const addresses = await dns.lookup(parsed.hostname, { all: true }).catch(() => []);
  // [why] reject if ALL addresses resolve to private ranges or if DNS returned nothing useful
  if (addresses.length === 0) return false;
  return addresses.every(({ address }) => !BLOCKED_IP.test(address));
}
