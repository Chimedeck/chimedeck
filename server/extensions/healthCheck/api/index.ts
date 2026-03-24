// Health Check API router — registers all health check routes.
// Probe endpoints (/:id/probe, /probe-all) are deferred to Iteration 4.
import { handleGetPresets } from './presets';
import { handleListHealthChecks } from './list';
import { handleCreateHealthCheck } from './create';
import { handleRemoveHealthCheck } from './remove';

// Returns a Response if the path matches a health-check route, otherwise null.
export async function healthCheckRouter(
  req: Request,
  pathname: string,
): Promise<Response | null> {
  // GET /api/v1/health-check/presets — global presets list (no board scope)
  if (pathname === '/api/v1/health-check/presets' && req.method === 'GET') {
    return handleGetPresets(req);
  }

  // Board-scoped health check routes: /api/v1/boards/:boardId/health-checks[/:id]
  const collectionMatch = pathname.match(/^\/api\/v1\/boards\/([^/]+)\/health-checks$/);
  if (collectionMatch) {
    const boardId = collectionMatch[1] as string;
    if (req.method === 'GET') return handleListHealthChecks(req, boardId);
    if (req.method === 'POST') return handleCreateHealthCheck(req, boardId);
  }

  const itemMatch = pathname.match(/^\/api\/v1\/boards\/([^/]+)\/health-checks\/([^/]+)$/);
  if (itemMatch) {
    const boardId = itemMatch[1] as string;
    const healthCheckId = itemMatch[2] as string;
    if (req.method === 'DELETE') return handleRemoveHealthCheck(req, boardId, healthCheckId);
  }

  return null;
}
