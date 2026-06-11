import { applyBoardVisibilityFromCard } from '../../../middlewares/boardVisibility';
import { flags } from '../../../mods/flags';
import { AS_BUILT_SYNC_FLAG_KEY } from '../common/config';
import { handleSyncAsBuilt } from './sync';
import { resolveCardId } from '../../../common/ids/resolveEntityId';

/**
 * As-Built Sync router — matches:
 * - POST /api/v1/cards/:cardId/as-built/sync
 *
 * Returns a Response if the path matches, otherwise null so other routers
 * can handle the request.
 *
 * [why] Card ID resolution and board visibility enforcement happen here
 * so the handler can focus on business logic. Follows the sprintGeneration
 * router pattern.
 */
export async function asBuiltSyncRouter(
  req: Request,
  pathname: string,
): Promise<Response | null> {
  const syncMatch = pathname.match(
    /^\/api\/v1\/cards\/([^/]+)\/as-built\/sync$/,
  );
  if (!syncMatch) return null;

  const cardIdentifier = syncMatch[1] as string;

  const cardId = await resolveCardId(cardIdentifier);
  if (!cardId) {
    return Response.json(
      { name: 'card-not-found', data: { message: 'Card not found' } },
      { status: 404 },
    );
  }

  // Feature-flag gate — return 404 when as-built sync is disabled
  const asBuiltSyncEnabled = await flags.isEnabled(AS_BUILT_SYNC_FLAG_KEY);
  if (!asBuiltSyncEnabled) {
    return Response.json(
      {
        name: 'as-built-sync-disabled',
        data: { message: 'As-Built Sync feature is disabled' },
      },
      { status: 404 },
    );
  }

  // Enforce board visibility via the card
  const visibilityError = await applyBoardVisibilityFromCard(req, cardId);
  if (visibilityError) return visibilityError;

  if (req.method === 'POST') {
    return handleSyncAsBuilt(req, cardId);
  }

  return null;
}
