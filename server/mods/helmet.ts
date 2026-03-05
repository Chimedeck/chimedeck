export interface SecurityHeaderOptions {
  /**
   * Origins to add to the frame-src directive (e.g. plugin connector_url origins).
   * Defaults to an empty list — when empty the directive is set to 'none'.
   */
  extraFrameSrc?: string[];
  /**
   * Origins to add to the connect-src directive (e.g. plugin whitelisted_domains).
   * Always includes 'self' and wss:.
   */
  extraConnectSrc?: string[];
}

// Applies security headers to every response.
// [why] extraFrameSrc / extraConnectSrc are injected at request time so that
// dynamically registered plugin iframes and their declared API domains are
// allowed by the browser's CSP enforcement.
export function applySecurityHeaders(headers: Headers, opts: SecurityHeaderOptions = {}): void {
  const { extraFrameSrc = [], extraConnectSrc = [] } = opts;

  const frameSrc = extraFrameSrc.length > 0
    ? `'self' ${extraFrameSrc.join(' ')}`
    : "'none'";

  const connectSrc = ['\'self\'', 'wss:', ...extraConnectSrc].join(' ');

  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  );
  headers.set(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src ${connectSrc}; object-src 'none'; frame-src ${frameSrc}; frame-ancestors 'none'`
  );
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
}
