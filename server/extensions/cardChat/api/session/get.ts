// GET /api/v1/cards/:cardId/chat
// Sprint 171 — returns the current session and latest message, or null if no session exists.
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { requireWorkspaceMembership, type WorkspaceScopedRequest } from '../../../../middlewares/permissionManager';
import { db } from '../../../../common/db';
import type { CardChatSession, CardChatMessage } from '../../types';

export const cardChatSessionGetDeps = {
  authenticate,
  requireWorkspaceMembership,
  db,
};

/**
 * Fetch the current active session (ACTIVE_REFINEMENT or PAUSED) for a card
 * along with the most recent message. Returns { data: null } if no session exists.
 *
 * [why] READY_FOR_REVIEW sessions are excluded — they're considered complete,
 * not "current". IDLE (no session at all) returns null, not 404, because the
 * card exists but simply has no chat associated with it.
 */
export async function handleGetCardChatSession(req: Request, cardId: string): Promise<Response> {
  const authError = await cardChatSessionGetDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const workspaceReq = req as WorkspaceScopedRequest;
  const membershipError = await cardChatSessionGetDeps.requireWorkspaceMembership(
    workspaceReq,
    workspaceReq.workspaceId ?? '',
  );
  if (membershipError) return membershipError;

  const session = (await cardChatSessionGetDeps
    .db('card_chat_sessions')
    .where({ card_id: cardId })
    .whereIn('status', ['ACTIVE_REFINEMENT', 'PAUSED'])
    .orderBy('created_at', 'desc')
    .first()) as CardChatSession | undefined | null;

  if (!session) {
    return Response.json({ data: null }, { status: 200 });
  }

  const latestMessage = (await cardChatSessionGetDeps
    .db('card_chat_messages')
    .where({ session_id: session.id })
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .first()) as CardChatMessage | undefined | null;

  return Response.json(
    {
      data: {
        session,
        latestMessage: latestMessage ?? null,
      },
    },
    { status: 200 },
  );
}
