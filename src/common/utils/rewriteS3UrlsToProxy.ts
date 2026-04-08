// Utility for rewriting legacy raw S3 URLs to the secure attachment proxy path.
// Used by card description and comment renderers to ensure that stored S3 presigned
// URLs (from before the secure-proxy migration) render via the authenticated proxy.
import type { Attachment } from '~/extensions/Attachments/types';

// Matches any https://...amazonaws.com/... URL including presigned query params.
// We allow a broad range of trailing characters so the same regex works inside
// both plain-text markdown (terminated by ) or whitespace) and HTML attributes
// (terminated by " or ').
const S3_URL_RE =
  /https?:\/\/[^\s"'<>()[\]]*\.amazonaws\.com\/[^\s"'<>()[\]]*/g;

/**
 * Tries to extract the S3 object key from a stored S3 URL.
 *
 * Handles two common URL styles:
 *  - Virtual-hosted: https://<bucket>.s3[.region].amazonaws.com/<key>[?params]
 *  - Path-style:     https://s3[.region].amazonaws.com/<bucket>/<key>[?params]
 *
 * Returns null when the URL does not look like an S3 URL or cannot be parsed.
 */
export function extractS3KeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    const pathname = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');

    // Virtual-hosted style: <anything>.s3[.region].amazonaws.com
    if (/\.s3[.-]/.test(hostname) && hostname.endsWith('.amazonaws.com')) {
      // pathname IS the key (no bucket prefix)
      return pathname || null;
    }

    // Path-style: s3[.region].amazonaws.com/bucket/key
    if (/^s3[.-]/.test(hostname) && hostname.endsWith('.amazonaws.com')) {
      const slashIdx = pathname.indexOf('/');
      if (slashIdx < 0) return null;
      return pathname.slice(slashIdx + 1) || null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Builds lookup maps from S3 URLs and keys to proxy view_url values.
 * Only FILE-type attachments with a non-null view_url are included.
 */
function buildProxyMaps(attachments: Attachment[]): {
  urlMap: Map<string, string>;
  keyMap: Map<string, string>;
} {
  const urlMap = new Map<string, string>();
  const keyMap = new Map<string, string>();

  for (const a of attachments) {
    if (a.type !== 'FILE' || !a.view_url) continue;

    // Direct URL matches (strip presigned query params for a stable key)
    // [why] attachment.thumbnail_url may still carry a presigned S3 URL in legacy data.
    for (const rawUrl of [a.thumbnail_url]) {
      if (!rawUrl) continue;
      try {
        const stripped = new URL(rawUrl);
        stripped.search = '';
        urlMap.set(stripped.toString(), a.view_url);
        // Also keep the original in case it appears verbatim in stored content
        urlMap.set(rawUrl, a.view_url);
      } catch {
        urlMap.set(rawUrl, a.view_url);
      }
    }

    // Key-based match for URLs whose presigned params have changed since storage
    if (a.key) {
      keyMap.set(a.key, a.view_url);
    }
  }

  return { urlMap, keyMap };
}

/**
 * Rewrites raw S3 URLs found in `content` to the proxy view path stored in
 * the matching attachment's `view_url`.
 *
 * Works for both Markdown and HTML content (matches by regex, no parsing).
 * Non-S3 URLs and S3 URLs with no matching attachment are left unchanged.
 */
export function rewriteS3UrlsToProxy(content: string, attachments: Attachment[]): string {
  if (!content || attachments.length === 0) return content;

  const { urlMap, keyMap } = buildProxyMaps(attachments);
  if (urlMap.size === 0 && keyMap.size === 0) return content;

  return content.replace(S3_URL_RE, (s3Url: string) => {
    // 1. Direct URL match (with and without query string)
    const direct = urlMap.get(s3Url);
    if (direct) return direct;

    try {
      const stripped = new URL(s3Url);
      stripped.search = '';
      const withoutParams = stripped.toString();
      const byStripped = urlMap.get(withoutParams);
      if (byStripped) return byStripped;
    } catch {
      // malformed — ignore
    }

    // 2. Key-based match (handles rotated presigned params)
    const key = extractS3KeyFromUrl(s3Url);
    if (key) {
      const byKey = keyMap.get(key);
      if (byKey) return byKey;
    }

    return s3Url;
  });
}
