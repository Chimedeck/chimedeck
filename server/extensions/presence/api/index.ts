// server/extensions/presence/api/index.ts
// Presence API router — re-exports GET /api/v1/boards/:id/presence.
// The handler lives in realtime/api/presence.ts (sprint 09);
// this module just routes to it so the presence extension has its own entry point.
import { handleGetPresence } from '../../realtime/api/presence';

export async function presenceRouter(req: Request, pathname: string): Promise<Response | null> {
  // GET /api/v1/boards/:id/presence
  const match = pathname.match(/^\/api\/v1\/boards\/([^/]+)\/presence$/);
  if (match && req.method === 'GET') {
    return handleGetPresence(req, match[1] as string);
  }

  return null;
}
