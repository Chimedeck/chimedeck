// POST /api/v1/cards/:cardId/chat/session/resume
// Sprint 171 — resume a paused or idle card-chat session back to ACTIVE_REFINEMENT.
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { resumeSession } from '../../mods/session/lifecycle';
import { emitCardChatActivity } from '../../mods/activities';

export const cardChatSessionResumeApiDeps = {
  authenticate,
  requireWorkspaceMembership,
  resumeSession,
  emitCardChatActivity,
};

export async function handleResumeCardChatSession(req: Request, cardId: string): Promise<Response> {
  const authError = await cardChatSessionResumeApiDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const authReq = req as AuthenticatedRequest;
  const workspaceReq = req as WorkspaceScopedRequest;

  const membershipError = await cardChatSessionResumeApiDeps.requireWorkspaceMembership(
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

  const result = await cardChatSessionResumeApiDeps.resumeSession({
    sessionId: body.sessionId,
    cardId,
    userId: authReq.currentUser!.id,
  });

  if ('name' in result) {
    return Response.json({ name: result.name, data: result.data }, { status: result.status });
  }

  // [why] Fire-and-forget activity emission for resume — the session is already
  // persisted. Mirroring the pause handler pattern: emit after commit.
  cardChatSessionResumeApiDeps.emitCardChatActivity({
    type: 'card_ai_assist_started',
    cardId,
    sessionId: body.sessionId,
    actorId: authReq.currentUser!.id,
  });

  return Response.json({ data: result.data.session }, { status: result.status });
}
