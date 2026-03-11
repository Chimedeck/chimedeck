// CSRF guard — validates the Origin (or Referer) header on all state-mutating requests.
// Applies to POST, PUT, PATCH, DELETE methods only; GET/HEAD/OPTIONS are safe by nature.
//
// Decision: if both Origin and Referer headers are absent we ALLOW the request.
// This preserves compatibility with non-browser clients (mobile apps, server-to-server, curl).
// The assumption is that browser-initiated requests ALWAYS send Origin or Referer.
import { env } from '../config/env';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// In development the Vite dev server (localhost:5173) proxies requests to the API server
// (localhost:3000). The browser always sends the real Origin (e.g. localhost:5173), not the
// proxy target, so any localhost-to-localhost request must be treated as same-origin.
function isAllowedOrigin(origin: string, base: string): boolean {
  if (origin.startsWith(base)) return true;

  // Allow any localhost / 127.0.0.1 origin when the server itself is on localhost.
  // This covers the Vite dev-server proxy scenario without requiring per-developer env config.
  const baseIsLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base);
  const originIsLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(origin);
  if (baseIsLocalhost && originIsLocalhost) return true;

  // CSRF_ALLOWED_ORIGINS — optional comma-separated list of additional trusted origins.
  const extra = env.CSRF_ALLOWED_ORIGINS;
  if (extra) {
    return extra.split(',').some((o) => origin.startsWith(o.trim()));
  }

  return false;
}

// Returns a 403 Response if the request fails the CSRF origin check, null otherwise.
export function csrfGuard(req: Request): Response | null {
  if (!MUTATING_METHODS.has(req.method)) return null;

  const origin = req.headers.get('origin') ?? req.headers.get('referer');

  // No origin header — allow (non-browser client or same-origin request without header).
  if (!origin) return null;

  if (!isAllowedOrigin(origin, env.APP_BASE_URL)) {
    return Response.json(
      {
        error: {
          code: 'csrf-origin-mismatch',
          message: 'Cross-site request blocked.',
        },
      },
      { status: 403 },
    );
  }

  return null;
}
