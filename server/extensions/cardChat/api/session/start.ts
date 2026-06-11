// POST /api/v1/cards/:cardId/chat/session/start
// Sprint 171 — start or resume a card-chat session.
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { requireWorkspaceMembership, type WorkspaceScopedRequest } from '../../../../middlewares/permissionManager';
import { startSession } from '../../mods/session/lifecycle';

export const cardChatSessionStartApiDeps = {
  authenticate,
  requireWorkspaceMembership,
  startSession,
};

export async function handleStartCardChatSession(req: Request, cardId: string): Promise<Response> {
  const authError = await cardChatSessionStartApiDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const authReq = req as AuthenticatedRequest;
  const workspaceReq = req as WorkspaceScopedRequest;

  const membershipError = await cardChatSessionStartApiDeps.requireWorkspaceMembership(
    workspaceReq,
    workspaceReq.workspaceId ?? '',
  );
  if (membershipError) return membershipError;

  const result = await cardChatSessionStartApiDeps.startSession({
    cardId,
    workspaceId: workspaceReq.workspaceId!,
    userId: authReq.currentUser!.id,
  });

  return Response.json({ data: result.data.session }, { status: result.status });
}
