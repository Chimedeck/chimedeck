export interface SecurityHeaderOptions {
  /**
   * Origins to add to the frame-src directive (e.g. plugin connector_url origins).
    * Always includes 'self' and blob: so in-app blob-backed previews (e.g. PDFs)
    * can render safely in iframes.
   */
  extraFrameSrc?: string[];
  /**
   * Origins to add to the connect-src directive (e.g. plugin whitelisted_domains).
   * Always includes 'self' and wss:.
   */
  extraConnectSrc?: string[];
  /**
   * Origins to add to the img-src directive (e.g. S3 bucket URL, CDN).
   * Always includes 'self', data:, and blob:.
   */
  extraImgSrc?: string[];
  /**
   * Origins to add to the style-src directive for pages that load external CSS.
   */
  extraStyleSrc?: string[];
  /**
   * Origins to add to the script-src directive for pages that load external JS.
   */
  extraScriptSrc?: string[];
  /**
   * Override frame-ancestors directive for endpoints that must be embeddable
   * by same-origin pages (e.g. attachment inline preview iframe).
   */
  frameAncestors?: string;
}

// Applies security headers to every response.
// [why] extraFrameSrc / extraConnectSrc are injected at request time so that
// dynamically registered plugin iframes and their declared API domains are
// allowed by the browser's CSP enforcement.
export function applySecurityHeaders(headers: Headers, opts: SecurityHeaderOptions = {}): void {
  const {
    extraFrameSrc = [],
    extraConnectSrc = [],
    extraImgSrc = [],
    extraStyleSrc = [],
    extraScriptSrc = [],
    frameAncestors = "'none'",
  } = opts;

  const frameSrc = ['\'self\'', 'blob:', ...extraFrameSrc].join(' ');

  const connectSrc = ['\'self\'', 'wss:', ...extraConnectSrc].join(' ');

  const imgSrc = ['\'self\'', 'data:', 'blob:', ...extraImgSrc].join(' ');
  const styleSrc = ['\'self\'', "'unsafe-inline'", ...extraStyleSrc].join(' ');
  const scriptSrc = ['\'self\'', 'https://static.cloudflareinsights.com', ...extraScriptSrc].join(' ');

  const xFrameOptions = frameAncestors === "'self'" ? 'SAMEORIGIN' : 'DENY';

  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', xFrameOptions);
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  );
  headers.set(
    'Content-Security-Policy',
    `default-src 'self'; script-src ${scriptSrc}; worker-src 'self' blob:; style-src ${styleSrc}; img-src ${imgSrc}; connect-src ${connectSrc}; object-src 'none'; frame-src ${frameSrc}; frame-ancestors ${frameAncestors}`
  );
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
}
