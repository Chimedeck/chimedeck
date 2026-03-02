// server/extensions/search/api/index.ts
// Search API router.
import { handleSearch } from './query';

export async function searchRouter(req: Request, pathname: string): Promise<Response | null> {
  // GET /api/v1/workspaces/:id/search
  const match = pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/search$/);
  if (match && req.method === 'GET') {
    return handleSearch(req, match[1] as string);
  }

  return null;
}
