// Card-Chat API router — mounts all card-scoped chat routes (Sprint 171).
// Slots in alongside the existing card router under /api/v1/cards/:cardId/chat.
import { applyBoardVisibilityFromCard } from '../../../middlewares/boardVisibility';
import { flags } from '../../../mods/flags';
import { INNER_CARD_CHAT_FLAG_KEY } from '../common/config';
import { handleGetCardChatMessages, handleCreateCardChatMessage } from './messages';
import { handleStartCardChatSession, handlePauseCardChatSession, handleResumeCardChatSession, handleGetCardChatSession } from './session';
import { handleRefineCardChat } from './refine';
import { resolveCardId } from '../../../common/ids/resolveEntityId';
import type { BoardVisibilityScopedRequest } from '../../../middlewares/boardVisibility';
import type { WorkspaceScopedRequest } from '../../../middlewares/permissionManager';
import { handleProposeCardDescription } from './proposeDescription';

/**
 * Card-chat router — matches /api/v1/cards/:cardId/chat[/sub].
 * Returns a Response if the path matches, otherwise null so the existing card
 * router can handle other card routes.
 *
 * [why] We resolve the cardId and enforce board visibility here rather than
 * delegating to the card router, because the card router is unaware of
 * card-chat sub-routes. This keeps the router self-contained and avoids
 * coupling card-chat route dispatch to the card router's match table.
 */
export async function cardChatRouter(req: Request, pathname: string): Promise<Response | null> {
  const cardChatMatch = pathname.match(/^\/api\/v1\/cards\/([^/]+)\/chat(\/.*)?$/);
  if (!cardChatMatch) return null;

  const cardIdentifier = cardChatMatch[1] as string;
  const cardId = await resolveCardId(cardIdentifier);
  if (!cardId) {
    return Response.json(
      { name: 'card-not-found', data: { message: 'Card not found' } },
      { status: 404 },
    );
  }
  const sub = cardChatMatch[2] ?? '';

  // Feature-flag gate — return 404 when card-chat is disabled
  const innerCardChatEnabled = await flags.isEnabled(INNER_CARD_CHAT_FLAG_KEY);
  if (!innerCardChatEnabled) {
    return Response.json(
      {
        name: 'inner-card-chat-disabled',
        data: { message: 'Card chat feature is disabled' },
      },
      { status: 404 },
    );
  }

  // Enforce board visibility via the card — this also populates req.workspaceId
  // so session/message handlers have access to workspace context.
  const visibilityError = await applyBoardVisibilityFromCard(req, cardId);
  if (visibilityError) return visibilityError;

  // GET /api/v1/cards/:cardId/chat
  if (sub === '' && req.method === 'GET') return handleGetCardChatSession(req, cardId);

  // GET /api/v1/cards/:cardId/chat/messages
  if (sub === '/messages' && req.method === 'GET') return handleGetCardChatMessages(req, cardId);

  // POST /api/v1/cards/:cardId/chat/messages
  if (sub === '/messages' && req.method === 'POST') return handleCreateCardChatMessage(req, cardId);

  // POST /api/v1/cards/:cardId/chat/session/start
  if (sub === '/session/start' && req.method === 'POST') return handleStartCardChatSession(req, cardId);

  // POST /api/v1/cards/:cardId/chat/session/pause
  if (sub === '/session/pause' && req.method === 'POST') return handlePauseCardChatSession(req, cardId);

  // POST /api/v1/cards/:cardId/chat/session/resume
  if (sub === '/session/resume' && req.method === 'POST') return handleResumeCardChatSession(req, cardId);

  // POST /api/v1/cards/:cardId/chat/refine
  if (sub === '/refine' && req.method === 'POST') return handleRefineCardChat(req, cardId);

  // POST /api/v1/cards/:cardId/chat/propose-description
  if (sub === '/propose-description' && req.method === 'POST') return handleProposeCardDescription(req, cardId);

  return null;
}
