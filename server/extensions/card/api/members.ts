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
import { emitCardMemberAssigned, emitCardMemberUnassigned } from '../../activity/mods/createActivityEvent';

interface CardContext {
  boardId: string;
  workspaceId: string;
}

async function resolveCardContext(cardId: string): Promise<CardContext | null> {
  const card = await db('cards').where({ id: cardId }).first();
  if (!card) return null;
  const list = await db('lists').where({ id: card.list_id }).first();
  if (!list) return null;
  const board = await db('boards').where({ id: list.board_id }).first();
  if (!board) return null;
  return { boardId: board.id, workspaceId: board.workspace_id };
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

  const context = await resolveCardContext(cardId);
  if (!context) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card context not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, context.workspaceId);
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
    .where({ user_id: body.userId, workspace_id: context.workspaceId })
    .first();

  if (!targetMembership) {
    return Response.json(
      { error: { code: 'member-not-in-workspace', message: 'User is not a member of this workspace' } },
      { status: 400 },
    );
  }

  // Idempotency: already assigned → return 200 without emitting a duplicate event
  const existing = await db('card_members').where({ card_id: cardId, user_id: body.userId }).first();
  if (existing) {
    return Response.json({ data: { card_id: cardId, user_id: body.userId } });
  }

  const actorId = (req as AuthenticatedRequest).currentUser!.id;

  await db('card_members').insert({ card_id: cardId, user_id: body.userId });

  await emitCardMemberAssigned({
    actorId,
    cardId,
    cardTitle: card.title,
    userId: body.userId,
    boardId: context.boardId,
    workspaceId: context.workspaceId,
    ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? null,
    userAgent: req.headers.get('user-agent') ?? null,
  });

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

  const context = await resolveCardContext(cardId);
  if (!context) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card context not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, context.workspaceId);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  // Only emit an event if the membership actually existed (avoid phantom unassign events)
  const existing = await db('card_members').where({ card_id: cardId, user_id: userId }).first();
  await db('card_members').where({ card_id: cardId, user_id: userId }).delete();

  if (existing) {
    const actorId = (req as AuthenticatedRequest).currentUser!.id;
    await emitCardMemberUnassigned({
      actorId,
      cardId,
      cardTitle: card.title,
      userId,
      boardId: context.boardId,
      workspaceId: context.workspaceId,
      ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? null,
      userAgent: req.headers.get('user-agent') ?? null,
    });
  }

  return new Response(null, { status: 204 });
}
