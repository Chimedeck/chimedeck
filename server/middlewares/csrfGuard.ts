// CSRF guard — validates the Origin (or Referer) header on all state-mutating requests.
// Applies to POST, PUT, PATCH, DELETE methods only; GET/HEAD/OPTIONS are safe by nature.
//
// Decision: if both Origin and Referer headers are absent we ALLOW the request.
// This preserves compatibility with non-browser clients (mobile apps, server-to-server, curl).
// The assumption is that browser-initiated requests ALWAYS send Origin or Referer.
import { env } from '../config/env';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Returns a 403 Response if the request fails the CSRF origin check, null otherwise.
export function csrfGuard(req: Request): Response | null {
  if (!MUTATING_METHODS.has(req.method)) return null;

  const origin = req.headers.get('origin') ?? req.headers.get('referer');

  // No origin header — allow (non-browser client or same-origin request without header).
  if (!origin) return null;

  const allowed = env.APP_BASE_URL;

  if (!origin.startsWith(allowed)) {
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
