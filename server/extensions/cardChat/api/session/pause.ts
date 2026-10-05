// POST /api/v1/cards/:cardId/chat/session/pause
// Sprint 171 — pause a card-chat session.
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { pauseSession } from '../../mods/session/lifecycle';
import { emitCardChatActivity } from '../../mods/activities';

export const cardChatSessionPauseApiDeps = {
  authenticate,
  requireWorkspaceMembership,
  pauseSession,
  emitCardChatActivity,
};

export async function handlePauseCardChatSession(req: Request, cardId: string): Promise<Response> {
  const authError = await cardChatSessionPauseApiDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const authReq = req as AuthenticatedRequest;
  const workspaceReq = req as WorkspaceScopedRequest;

  const membershipError = await cardChatSessionPauseApiDeps.requireWorkspaceMembership(
    workspaceReq,
    workspaceReq.workspaceId ?? ''
  );
  if (membershipError) return membershipError;

  let body: { sessionId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'invalid-request-body', data: { message: 'Request body must be JSON' } },
      { status: 400 }
    );
  }

  if (typeof body.sessionId !== 'string' || body.sessionId === '') {
    return Response.json(
      { name: 'missing-session-id', data: { message: 'sessionId is required' } },
      { status: 400 }
    );
  }

  const result = await cardChatSessionPauseApiDeps.pauseSession({
    sessionId: body.sessionId,
    cardId,
    userId: authReq.currentUser!.id,
  });

  if ('name' in result) {
    return Response.json({ name: result.name, data: result.data }, { status: result.status });
  }

  // [why] Fire-and-forget activity emission — failures are logged but never
  // block the pause response. The pause is already committed to the database.
  cardChatSessionPauseApiDeps.emitCardChatActivity({
    type: 'card_ai_assist_paused',
    cardId,
    sessionId: body.sessionId,
    actorId: authReq.currentUser!.id,
  });

  return Response.json({ data: result.data.session }, { status: result.status });
}
