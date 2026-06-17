// GET /api/v1/cards/:cardId/chat/sessions
// Sprint 208 — list all chat sessions for a card so the user can
// switch between past conversations instead of always starting fresh.
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { requireWorkspaceMembership, type WorkspaceScopedRequest } from '../../../../middlewares/permissionManager';
import { db } from '../../../../common/db';
import type { CardChatSession } from '../../types';

export const cardChatSessionsListDeps = {
  authenticate,
  requireWorkspaceMembership,
  db,
};

export async function handleListCardChatSessions(req: Request, cardId: string): Promise<Response> {
  const authError = await cardChatSessionsListDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const workspaceReq = req as WorkspaceScopedRequest;
  const membershipError = await cardChatSessionsListDeps.requireWorkspaceMembership(
    workspaceReq,
    workspaceReq.workspaceId ?? '',
  );
  if (membershipError) return membershipError;

  const sessions = (await cardChatSessionsListDeps
    .db('card_chat_sessions')
    .where({ card_id: cardId })
    .orderBy('created_at', 'desc')
    .limit(50)
    .select('*')) as CardChatSession[];

  return Response.json({ data: sessions }, { status: 200 });
}
