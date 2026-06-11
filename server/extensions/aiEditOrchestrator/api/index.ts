// AI Edit Orchestrator router — mounts card-scoped edit routes (Sprint 175).
// Slots in alongside the aiContext router under /api/v1/cards/:cardId/ai/edit.
import { applyBoardVisibilityFromCard } from '../../../middlewares/boardVisibility';
import { flags } from '../../../mods/flags';
import { AI_EDIT_FLAG_KEY } from '../common/config';
import { handleCreateEditRun } from './edit';
import { handleApproveEditRun } from './approve';
import { handleRejectEditRun } from './reject';
import { resolveCardId } from '../../../common/ids/resolveEntityId';
import type { BoardVisibilityScopedRequest } from '../../../middlewares/boardVisibility';
import type { WorkspaceScopedRequest } from '../../../middlewares/permissionManager';

/**
 * AI Edit Orchestrator router — matches:
 * - POST /api/v1/cards/:cardId/ai/edit
 * - POST /api/v1/cards/:cardId/ai/edit/:runId/approve
 * - POST /api/v1/cards/:cardId/ai/edit/:runId/reject
 *
 * Returns a Response if the path matches, otherwise null so other routers
 * can handle the request.
 *
 * [why] We resolve the cardId and enforce board visibility here so handlers
 * don't need to repeat these checks. This pattern matches the cardChat router
 * and aiContext router.
 */
export async function aiEditOrchestratorRouter(
  req: Request,
  pathname: string,
): Promise<Response | null> {
  // Match all edit routes: /api/v1/cards/:cardId/ai/edit[/:runId/approve|reject]
  const editMatch = pathname.match(
    /^\/api\/v1\/cards\/([^/]+)\/ai\/edit(?:\/([^/]+)\/(approve|reject))?$/,
  );
  if (!editMatch) return null;

  const cardIdentifier = editMatch[1] as string;
  const runId = editMatch[2] as string | undefined;
  const subAction = editMatch[3] as 'approve' | 'reject' | undefined;

  const cardId = await resolveCardId(cardIdentifier);
  if (!cardId) {
    return Response.json(
      { name: 'card-not-found', data: { message: 'Card not found' } },
      { status: 404 },
    );
  }

  // Feature-flag gate — return 404 when ai-edit is disabled
  const aiEditEnabled = await flags.isEnabled(AI_EDIT_FLAG_KEY);
  if (!aiEditEnabled) {
    return Response.json(
      {
        name: 'ai-edit-disabled',
        data: { message: 'AI Edit feature is disabled' },
      },
      { status: 404 },
    );
  }

  // Enforce board visibility via the card
  const visibilityError = await applyBoardVisibilityFromCard(req, cardId);
  if (visibilityError) return visibilityError;

  if (req.method === 'POST') {
    // POST /api/v1/cards/:cardId/ai/edit/:runId/approve
    if (runId && subAction === 'approve') {
      return handleApproveEditRun(req, cardId, runId);
    }

    // POST /api/v1/cards/:cardId/ai/edit/:runId/reject
    if (runId && subAction === 'reject') {
      return handleRejectEditRun(req, cardId, runId);
    }

    // POST /api/v1/cards/:cardId/ai/edit
    return handleCreateEditRun(req, cardId);
  }

  return null;
}
