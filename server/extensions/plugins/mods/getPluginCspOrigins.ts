// Fetches all CSP-relevant origins from active plugins so they can be injected
// into the server's Content-Security-Policy header at request time.
//
// [why] Plugin connector_url origins must appear in frame-src so the browser
// allows the iframe to load. Plugin whitelisted_domains must appear in
// connect-src so scripts inside the plugin iframe can reach their declared APIs.
import { db } from '../../../common/db';

export interface PluginCspOrigins {
  /** Origins to add to frame-src (connector_url of each active plugin). */
  frameSrc: string[];
  /** Origins to add to connect-src (whitelisted_domains across all active plugins). */
  connectSrc: string[];
  /**
   * Origins to add to frame-ancestors (connector_url of each active plugin
   * plus workspace-level plugin_domains).
   * [why] Plugin connector URLs and workspace plugin domains must appear in
   * frame-ancestors so the browser permits plugin iframes to embed our board
   * pages. Without this, the browser blocks the embed with "Unsafe attempt to
   * load URL from frame with URL chrome-error://chromewebdata/."
   */
  frameAncestors: string[];
  imageSrc: string[]; // [future] Origins to add to img-src (e.g. S3 bucket URL, CDN)
}

function toOrigin(url: string): string | null {
  try {
    const { origin } = new URL(url);
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

/** Normalises a plugin domain entry (hostname or full origin) to an origin string. */
function normaliseDomain(d: string): string | null {
  return toOrigin(d.startsWith('http') ? d : `https://${d}`);
}

/** Collects frame-src, connect-src, and image-src origins from plugin rows. */
function collectPluginOrigins(plugins: Record<string, unknown>[]): {
  frameSrc: Set<string>;
  connectSrc: Set<string>;
  imageSrc: Set<string>;
} {
  const frameSrc = new Set<string>();
  const connectSrc = new Set<string>();
  const imageSrc = new Set<string>();

  for (const p of plugins) {
    addOrigin(frameSrc, p.connector_url);
    addOrigins(connectSrc, p.whitelisted_domains);
    addOrigin(imageSrc, p.connector_url);
  }

  return { frameSrc, connectSrc, imageSrc };
}

/** Collects frame-ancestors origins from workspace-level plugin_domains. */
function collectWorkspaceOrigins(rows: Record<string, unknown>[]): Set<string> {
  const origins = new Set<string>();

  for (const row of rows) {
    const domains: unknown = row.plugin_domains;
    if (Array.isArray(domains)) {
      for (const d of domains as string[]) {
        const origin = normaliseDomain(d);
        if (origin) origins.add(origin);
      }
    }
  }

  return origins;
}

/** Adds a single origin to a set if the value is a valid URL string. */
function addOrigin(set: Set<string>, value: unknown): void {
  if (typeof value !== 'string') return;
  // [why] connector_url may be stored without a protocol (e.g. "plugin.com/connector.html").
  // Prepend https:// so new URL() can parse it — same approach as normaliseDomain.
  const normalised = value.startsWith('http') ? value : `https://${value}`;
  const origin = toOrigin(normalised);
  if (origin) set.add(origin);
}

/** Adds origins from an array-like unknown value to a set using normaliseDomain. */
function addOrigins(set: Set<string>, value: unknown): void {
  if (!Array.isArray(value)) return;
  for (const d of value as string[]) {
    const origin = normaliseDomain(d);
    if (origin) set.add(origin);
  }
}

/**
 * Queries the database for all active plugins and returns the set of origins
 * that must be added to frame-src, connect-src, and frame-ancestors in the CSP.
 */
export async function getPluginCspOrigins(): Promise<PluginCspOrigins> {
  const plugins = await db('plugins')
    .where({ is_active: true })
    .select('connector_url', 'whitelisted_domains');

  const workspaceDomains = await db('workspaces')
    .whereNotNull('plugin_domains')
    .select('plugin_domains');

  const pluginOrigins = collectPluginOrigins(plugins as Record<string, unknown>[]);
  const workspaceOrigins = collectWorkspaceOrigins(workspaceDomains as Record<string, unknown>[]);

  // frame-ancestors = plugin connector_urls + workspace-level plugin domains
  const frameAncestors = new Set([...pluginOrigins.frameSrc, ...workspaceOrigins]);

  return {
    frameSrc: [...pluginOrigins.frameSrc],
    connectSrc: [...pluginOrigins.connectSrc],
    frameAncestors: [...frameAncestors],
    imageSrc: [...pluginOrigins.imageSrc], // [future] populate from plugin data as needed
  };
}
