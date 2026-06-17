// POST /api/v1/cards/:cardId/chat/assist/commit-description
// Sprint 208 — commit a confirmed description proposal to the card.
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { requireWorkspaceMembership, type WorkspaceScopedRequest } from '../../../../middlewares/permissionManager';
import { db } from '../../../../common/db';

export const cardChatAssistCommitDeps = {
  authenticate,
  requireWorkspaceMembership,
  db,
};

export async function handleCommitCardChatProposal(req: Request, cardId: string): Promise<Response> {
  const authError = await cardChatAssistCommitDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const workspaceReq = req as WorkspaceScopedRequest;

  const membershipError = await cardChatAssistCommitDeps.requireWorkspaceMembership(
    workspaceReq,
    workspaceReq.workspaceId ?? '',
  );
  if (membershipError) return membershipError;

  let body: { toolCallId?: string; idempotencyKey?: string; description?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'invalid-request-body', data: { message: 'Request body must be JSON' } },
      { status: 400 },
    );
  }

  if (typeof body.description !== 'string' || body.description.trim() === '') {
    return Response.json(
      { name: 'missing-description', data: { message: 'description is required' } },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();

  // Update the card description
  await cardChatAssistCommitDeps.db('cards')
    .where({ id: cardId })
    .update({
      description: body.description.trim(),
      updated_at: now,
    });

  return Response.json(
    { data: { success: true } },
    { status: 200 },
  );
}
