// Card members sub-resource: assign and remove members from cards.
// POST   /api/v1/cards/:id/members          — assign; min role MEMBER
// DELETE /api/v1/cards/:id/members/:userId  — remove; min role MEMBER
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

async function resolveWorkspaceId(cardId: string): Promise<string | null> {
  const card = await db('cards').where({ id: cardId }).first();
  if (!card) return null;
  const list = await db('lists').where({ id: card.list_id }).first();
  if (!list) return null;
  const board = await db('boards').where({ id: list.board_id }).first();
  return board?.workspace_id ?? null;
}

export async function handleAssignMember(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const card = await db('cards').where({ id: cardId }).first();
  if (!card) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card not found' } },
      { status: 404 },
    );
  }

  const workspaceId = await resolveWorkspaceId(cardId);
  if (!workspaceId) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card context not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, workspaceId);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  let body: { userId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.userId || typeof body.userId !== 'string') {
    return Response.json(
      { error: { code: 'bad-request', message: 'userId is required' } },
      { status: 400 },
    );
  }

  // Ensure the target user is a workspace member
  const targetMembership = await db('memberships')
    .where({ user_id: body.userId, workspace_id: workspaceId })
    .first();

  if (!targetMembership) {
    return Response.json(
      { error: { code: 'member-not-in-workspace', message: 'User is not a member of this workspace' } },
      { status: 400 },
    );
  }

  // Idempotency: already assigned → return 200
  const existing = await db('card_members').where({ card_id: cardId, user_id: body.userId }).first();
  if (existing) {
    return Response.json({ data: { card_id: cardId, user_id: body.userId } });
  }

  await db('card_members').insert({ card_id: cardId, user_id: body.userId });
  return Response.json({ data: { card_id: cardId, user_id: body.userId } }, { status: 201 });
}

export async function handleRemoveMember(
  req: Request,
  cardId: string,
  userId: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const card = await db('cards').where({ id: cardId }).first();
  if (!card) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card not found' } },
      { status: 404 },
    );
  }

  const workspaceId = await resolveWorkspaceId(cardId);
  if (!workspaceId) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card context not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, workspaceId);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  await db('card_members').where({ card_id: cardId, user_id: userId }).delete();
  return new Response(null, { status: 204 });
}
