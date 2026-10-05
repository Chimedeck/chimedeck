// AI Context API router — mounts card-scoped context gathering routes (Sprint 174).
// Slots in alongside the card-chat router under /api/v1/cards/:cardId/ai/context.
import { applyBoardVisibilityFromCard } from '../../../middlewares/boardVisibility';
import { flags } from '../../../mods/flags';
import { AI_CONTEXT_FLAG_KEY } from '../common/config';
import { handleGatherContext } from './gather';
import { handleFileScope } from './fileScope';
import { resolveCardId } from '../../../common/ids/resolveEntityId';
import type { BoardVisibilityScopedRequest } from '../../../middlewares/boardVisibility';
import type { WorkspaceScopedRequest } from '../../../middlewares/permissionManager';

/**
 * AI Context router — matches /api/v1/cards/:cardId/ai/context[/sub]
 * and /api/v1/cards/:cardId/ai/file-scope.
 * Returns a Response if the path matches, otherwise null so other routers
 * can handle the request.
 *
 * [why] We resolve the cardId and enforce board visibility here so handlers
 * don't need to repeat these checks. This pattern matches the cardChat router.
 */
export async function aiContextRouter(req: Request, pathname: string): Promise<Response | null> {
  // Match /api/v1/cards/:cardId/ai/context[/sub]
  const contextMatch = pathname.match(/^\/api\/v1\/cards\/([^/]+)\/ai\/context(\/.*)?$/);
  // Match /api/v1/cards/:cardId/ai/file-scope
  const fileScopeMatch = pathname.match(/^\/api\/v1\/cards\/([^/]+)\/ai\/file-scope$/);

  if (!contextMatch && !fileScopeMatch) return null;

  const match = contextMatch ?? fileScopeMatch!;
  const cardIdentifier = match[1] as string;
  const cardId = await resolveCardId(cardIdentifier);
  if (!cardId) {
    return Response.json(
      { name: 'card-not-found', data: { message: 'Card not found' } },
      { status: 404 }
    );
  }

  // Feature-flag gate — return 404 when ai-context is disabled
  const aiContextEnabled = await flags.isEnabled(AI_CONTEXT_FLAG_KEY);
  if (!aiContextEnabled) {
    return Response.json(
      {
        name: 'ai-context-disabled',
        data: { message: 'AI Context feature is disabled' },
      },
      { status: 404 }
    );
  }

  // Enforce board visibility via the card
  const visibilityError = await applyBoardVisibilityFromCard(req, cardId);
  if (visibilityError) return visibilityError;

  if (contextMatch) {
    const sub = contextMatch[2] ?? '';

    // POST /api/v1/cards/:cardId/ai/context/gather
    if (sub === '/gather' && req.method === 'POST') return handleGatherContext(req, cardId);
  }

  if (fileScopeMatch) {
    // POST /api/v1/cards/:cardId/ai/file-scope
    if (req.method === 'POST') return handleFileScope(req, cardId);
  }

  return null;
}
