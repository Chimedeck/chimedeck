// Health Check API router — registers all health check routes.
import { handleGetPresets } from './presets';
import { handleListHealthChecks } from './list';
import { handleCreateHealthCheck } from './create';
import { handleRemoveHealthCheck } from './remove';
import { handleProbeHealthCheck } from './probe';
import { handleProbeAllHealthChecks } from './probeAll';

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

  // POST /api/v1/boards/:boardId/health-checks/probe-all — must be checked before /:id wildcard.
  const probeAllMatch = pathname.match(/^\/api\/v1\/boards\/([^/]+)\/health-checks\/probe-all$/);
  if (probeAllMatch && req.method === 'POST') {
    const boardId = probeAllMatch[1] as string;
    return handleProbeAllHealthChecks(req, boardId);
  }

  const itemMatch = pathname.match(/^\/api\/v1\/boards\/([^/]+)\/health-checks\/([^/]+)$/);
  if (itemMatch) {
    const boardId = itemMatch[1] as string;
    const healthCheckId = itemMatch[2] as string;
    if (req.method === 'DELETE') return handleRemoveHealthCheck(req, boardId, healthCheckId);
    if (req.method === 'POST') return handleProbeHealthCheck(req, boardId, healthCheckId);
  }

  return null;
}
