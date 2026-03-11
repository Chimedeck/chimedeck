// Automation API router — mounts all CRUD handlers for /api/v1/boards/:boardId/automations
// and the discovery endpoint GET /api/v1/automation/trigger-types.
import { handleListAutomations } from './list';
import { handleCreateAutomation } from './create';
import { handleGetAutomation } from './get';
import { handleUpdateAutomation } from './update';
import { handleDeleteAutomation } from './delete';
import { handleGetTriggerTypes } from './triggerTypes';
import { handleGetActionTypes } from './actionTypes';
// Register all card action handlers so the executor can resolve them by type.
import '../engine/actions/index';

// Returns a Response if the path matches an automation route, otherwise null.
export async function automationRouter(req: Request, pathname: string): Promise<Response | null> {
  // Discovery endpoints — not scoped to a specific board.
  if (pathname === '/api/v1/automation/trigger-types' && req.method === 'GET') {
    return handleGetTriggerTypes(req);
  }

  if (pathname === '/api/v1/automation/action-types' && req.method === 'GET') {
    return handleGetActionTypes(req);
  }

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
