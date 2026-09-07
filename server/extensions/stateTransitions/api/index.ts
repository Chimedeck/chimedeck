import { applyBoardVisibility } from '../../../middlewares/boardVisibility';
import { resolveBoardId } from '../../../common/ids/resolveEntityId';
import { featureFlags } from '../../../config/featureFlags';
import { handleGetStateTransitions } from './get';
import { handleGetStateTransitionRules } from './getRules';
import { handlePutStateTransitions } from './put';

export async function stateTransitionsRouter(req: Request, pathname: string): Promise<Response | null> {
  const baseMatch = pathname.match(/^\/api\/v1\/boards\/([^/]+)\/state-transitions$/);
  const rulesMatch = pathname.match(/^\/api\/v1\/boards\/([^/]+)\/state-transitions\/rules$/);
  const match = baseMatch ?? rulesMatch;
  if (!match) return null;

  if (!featureFlags.STATE_TRANSITIONS_ENABLED) {
    return Response.json(
      { name: 'not-implemented', data: { message: 'State transitions feature is not enabled' } },
      { status: 501 },
    );
  }

  const boardIdentifier = match[1] as string;
  const boardId = await resolveBoardId(boardIdentifier);
  if (!boardId) {
    return Response.json(
      { name: 'board-not-found', data: { message: 'Board not found' } },
      { status: 404 },
    );
  }

  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;

  if (rulesMatch && req.method === 'GET') return handleGetStateTransitionRules(req, boardId);
  if (baseMatch && req.method === 'GET') return handleGetStateTransitions(req, boardId);
  if (baseMatch && req.method === 'PUT') return handlePutStateTransitions(req, boardId);

  return null;
}
