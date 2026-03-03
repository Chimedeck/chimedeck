// PATCH /api/v1/cards/:id — update title, description, or due_date; min role: MEMBER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { writeEvent } from '../../../mods/events/write';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireCardWritable, type CardScopedRequest } from '../middlewares/requireCardWritable';

export async function handleUpdateCard(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const cardReq = req as CardScopedRequest;
  const writableError = await requireCardWritable(cardReq, cardId);
  if (writableError) return writableError;

  const board = cardReq.board!;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  let body: { title?: string; description?: string; due_date?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim() === '') {
      return Response.json(
        { name: 'bad-request', data: { message: 'title must be a non-empty string' } },
        { status: 400 },
      );
    }
    if (body.title.trim().length > 512) {
      return Response.json(
        { name: 'card-title-too-long', data: { message: 'title must be ≤ 512 characters' } },
        { status: 400 },
      );
    }
    updates.title = body.title.trim();
  }

  if (body.description !== undefined) {
    updates.description = body.description?.trim() ?? null;
  }

  if (body.due_date !== undefined) {
    updates.due_date = body.due_date;
  }

  const updated = await db('cards').where({ id: cardId }).update(updates, ['*']);

  // Use 'card_updated' to match client useBoardSync handler; send full card object
  await writeEvent({ type: 'card_updated', boardId: board.id, entityId: cardId, actorId: (req as AuthenticatedRequest).currentUser?.id ?? 'system', payload: { card: updated[0] } });

  return Response.json({ data: updated[0] });
}
