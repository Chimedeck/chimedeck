// Automation API router — mounts all CRUD handlers for /api/v1/boards/:boardId/automations.
import { handleListAutomations } from './list';
import { handleCreateAutomation } from './create';
import { handleGetAutomation } from './get';
import { handleUpdateAutomation } from './update';
import { handleDeleteAutomation } from './delete';

// Returns a Response if the path matches an automation route, otherwise null.
export async function automationRouter(req: Request, pathname: string): Promise<Response | null> {
  // Match /api/v1/boards/:boardId/automations[/:automationId]
  const listCreate = pathname.match(/^\/api\/v1\/boards\/([^/]+)\/automations$/);
  if (listCreate) {
    const boardId = listCreate[1] as string;
    if (req.method === 'GET') return handleListAutomations(req, boardId);
    if (req.method === 'POST') return handleCreateAutomation(req, boardId);
    return null;
  }

  const singleMatch = pathname.match(/^\/api\/v1\/boards\/([^/]+)\/automations\/([^/]+)$/);
  if (singleMatch) {
    const boardId = singleMatch[1] as string;
    const automationId = singleMatch[2] as string;
    if (req.method === 'GET') return handleGetAutomation(req, boardId, automationId);
    if (req.method === 'PATCH') return handleUpdateAutomation(req, boardId, automationId);
    if (req.method === 'DELETE') return handleDeleteAutomation(req, boardId, automationId);
    return null;
  }

  return null;
}
