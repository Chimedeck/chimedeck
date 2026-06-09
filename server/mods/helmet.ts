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
  /**
   * Extra origins to add to the frame-ancestors directive (e.g. plugin connector_url origins).
   * [why] When non-empty, frame-ancestors is built from 'self' plus these origins
   * instead of using the frameAncestors override, so plugin iframes can embed
   * our board pages. X-Frame-Options is omitted in this case since it doesn't
   * support multiple origins — CSP frame-ancestors handles the enforcement.
   */
  extraFrameAncestors?: string[];
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
    extraFrameAncestors = [],
  } = opts;

  const frameSrc = ['\'self\'', 'blob:', ...extraFrameSrc].join(' ');

  const connectSrc = ['\'self\'', 'wss:', ...extraConnectSrc].join(' ');

  const imgSrc = ['\'self\'', 'data:', 'blob:', ...extraImgSrc].join(' ');
  const styleSrc = ['\'self\'', "'unsafe-inline'", ...extraStyleSrc].join(' ');
  const scriptSrc = ['\'self\'', 'https://static.cloudflareinsights.com', ...extraScriptSrc].join(' ');

  // Build frame-ancestors directive.
  // [why] When plugin connector origins are present, frame-ancestors must include
  // 'self' plus those origins so plugin iframes can embed board pages. X-Frame-Options
  // is omitted in this case since it only supports DENY/SAMEORIGIN — CSP frame-ancestors
  // handles the multi-origin enforcement.
  const hasExtraAncestors = extraFrameAncestors.length > 0;
  let frameAncestorsValue: string;
  let xFrameOptions: string;

  if (hasExtraAncestors) {
    // Include 'self' so same-origin embeds still work, plus plugin connector origins.
    frameAncestorsValue = ['\'self\'', ...extraFrameAncestors].join(' ');
    // X-Frame-Options doesn't support multiple origins — omit it and rely on CSP.
    xFrameOptions = '';
  } else if (frameAncestors === "'self'") {
    frameAncestorsValue = "'self'";
    xFrameOptions = 'SAMEORIGIN';
  } else {
    frameAncestorsValue = "'none'";
    xFrameOptions = 'DENY';
  }

  headers.set('X-Content-Type-Options', 'nosniff');
  // [why] X-Frame-Options is only set when it's a valid value (DENY/SAMEORIGIN).
  // When extraFrameAncestors are present, CSP frame-ancestors handles multi-origin
  // enforcement and X-Frame-Options is omitted (empty string = no header set).
  if (xFrameOptions) {
    headers.set('X-Frame-Options', xFrameOptions);
  }
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  );
  headers.set(
    'Content-Security-Policy',
    `default-src 'self'; script-src ${scriptSrc}; worker-src 'self' blob:; style-src ${styleSrc}; img-src ${imgSrc}; connect-src ${connectSrc}; object-src 'none'; frame-src ${frameSrc}; frame-ancestors ${frameAncestorsValue}`
  );
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
}
