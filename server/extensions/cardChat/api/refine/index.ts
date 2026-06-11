// POST /api/v1/cards/:cardId/chat/refine
// Sprint 171 — run the BA persona goal loop for one refinement turn.
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { requireWorkspaceMembership, type WorkspaceScopedRequest } from '../../../../middlewares/permissionManager';
import { runGoalLoop } from '../../mods/baPersona/goalLoop';

export const cardChatRefineApiDeps = {
  authenticate,
  requireWorkspaceMembership,
  runGoalLoop,
};

export async function handleRefineCardChat(req: Request, cardId: string): Promise<Response> {
  const authError = await cardChatRefineApiDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const authReq = req as AuthenticatedRequest;
  const workspaceReq = req as WorkspaceScopedRequest;

  const membershipError = await cardChatRefineApiDeps.requireWorkspaceMembership(
    workspaceReq,
    workspaceReq.workspaceId ?? '',
  );
  if (membershipError) return membershipError;

  let body: { sessionId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'invalid-request-body', data: { message: 'Request body must be JSON' } },
      { status: 400 },
    );
  }

  if (typeof body.sessionId !== 'string' || body.sessionId === '') {
    return Response.json(
      { name: 'missing-session-id', data: { message: 'sessionId is required' } },
      { status: 400 },
    );
  }

  const card = authReq.currentUser; // Type narrowing — we know currentUser exists after auth.
  if (!card) {
    return Response.json(
      { name: 'unauthorized', data: { message: 'Authentication required' } },
      { status: 401 },
    );
  }

  try {
    const result = await cardChatRefineApiDeps.runGoalLoop({
      sessionId: body.sessionId,
      cardId,
      workspaceId: workspaceReq.workspaceId ?? '',
      userId: authReq.currentUser!.id,
    });

    if (result.status !== 200 || !result.data) {
      return Response.json(
        { name: result.name ?? 'refinement-failed', data: { message: result.message ?? 'Refinement failed' } },
        { status: result.status },
      );
    }

    return Response.json(
      {
        data: {
          assistantMessage: result.data.assistantMessage,
          session: result.data.session,
          qualityScore: result.data.qualityScore,
          loopComplete: result.data.loopComplete,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[cardChat/refine] Unexpected error:', error instanceof Error ? error.message : String(error));
    return Response.json(
      { name: 'internal-error', data: { message: 'Refinement failed unexpectedly' } },
      { status: 500 },
    );
  }
}
