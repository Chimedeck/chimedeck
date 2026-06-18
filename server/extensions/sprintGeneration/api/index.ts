import { applyBoardVisibilityFromCard } from '../../../middlewares/boardVisibility';
import { flags } from '../../../mods/flags';
import { SPRINT_GENERATION_FLAG_KEY } from '../common/config';
import { handleGenerateSprint } from './generate';
import { resolveCardId } from '../../../common/ids/resolveEntityId';
import type { BoardVisibilityScopedRequest } from '../../../middlewares/boardVisibility';
import type { WorkspaceScopedRequest } from '../../../middlewares/permissionManager';

/**
 * Sprint generation router — matches:
 * - POST /api/v1/cards/:cardId/sprint/generate
 *
 * Returns a Response if the path matches, otherwise null so other routers
 * can handle the request.
 *
 * [why] Card ID resolution and board visibility enforcement happen here
 * so the handler can focus on business logic.
 */
export async function sprintGenerationRouter(
  req: Request,
  pathname: string
): Promise<Response | null> {
  const generateMatch = pathname.match(/^\/api\/v1\/cards\/([^/]+)\/sprint\/generate$/);
  if (!generateMatch) return null;

  const cardIdentifier = generateMatch[1] as string;

  const cardId = await resolveCardId(cardIdentifier);
  if (!cardId) {
    return Response.json(
      { name: 'card-not-found', data: { message: 'Card not found' } },
      { status: 404 }
    );
  }

  // Feature-flag gate — return 404 when sprint generation is disabled
  const sprintGenEnabled = await flags.isEnabled(SPRINT_GENERATION_FLAG_KEY);
  if (!sprintGenEnabled) {
    return Response.json(
      {
        name: 'sprint-generation-disabled',
        data: { message: 'Sprint Generation feature is disabled' },
      },
      { status: 404 }
    );
  }

  // Enforce board visibility via the card
  const visibilityError = await applyBoardVisibilityFromCard(req, cardId);
  if (visibilityError) return visibilityError;

  if (req.method === 'POST') {
    return handleGenerateSprint(req, cardId);
  }

  return null;
}
