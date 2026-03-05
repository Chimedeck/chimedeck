// Validates that a string is a well-formed HTTPS origin (scheme + host + optional port, no path/query).
// e.g. "https://api.stripe.com" and "https://example.com:8443" are valid;
//      "http://example.com", "https://", and "https://example.com/path" are not.
export function isValidHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    if (!url.hostname) return false;
    // An origin has no pathname beyond "/", no search, and no hash.
    if (url.pathname !== '/' && url.pathname !== '') return false;
    if (url.search) return false;
    if (url.hash) return false;
    return true;
  } catch {
    return false;
  }
}
