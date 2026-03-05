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
}

function toOrigin(url: string): string | null {
  try {
    const { origin } = new URL(url);
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

/**
 * Queries the database for all active plugins and returns the set of origins
 * that must be added to frame-src and connect-src in the CSP.
 *
 * Called on every HTML-serving request; results should be cached by the caller
 * if performance becomes a concern.
 */
export async function getPluginCspOrigins(): Promise<PluginCspOrigins> {
  const plugins = await db('plugins')
    .where({ is_active: true })
    .select('connector_url', 'whitelisted_domains');

  const frameSrcSet = new Set<string>();
  const connectSrcSet = new Set<string>();

  for (const plugin of plugins) {
    // connector_url → frame-src so the iframe can be loaded.
    if (plugin.connector_url) {
      const origin = toOrigin(plugin.connector_url as string);
      if (origin) frameSrcSet.add(origin);
    }

    // whitelisted_domains → connect-src so the plugin can call its declared APIs.
    const domains: unknown = plugin.whitelisted_domains;
    if (Array.isArray(domains)) {
      for (const d of domains as string[]) {
        const origin = toOrigin(d);
        if (origin) connectSrcSet.add(origin);
      }
    }
  }

  return {
    frameSrc: [...frameSrcSet],
    connectSrc: [...connectSrcSet],
  };
}
