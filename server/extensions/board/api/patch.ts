// PATCH /api/v1/boards/:id — update monetization_type (and/or title); min role: ADMIN.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { guestGuard } from '../../../middlewares/guestGuard';
import { requireBoardWritable, type BoardScopedRequest } from '../middlewares/requireBoardWritable';
import { writeEvent } from '../../../mods/events/write';
import type { MonetizationType, BoardVisibility } from '../types';

const VALID_MONETIZATION_TYPES: Array<MonetizationType | null> = [null, 'pre-paid', 'pay-to-paid'];
const VALID_VISIBILITY: BoardVisibility[] = ['PUBLIC', 'PRIVATE', 'WORKSPACE'];

export async function handlePatchBoard(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardScopedReq = req as BoardScopedRequest;
  const writableError = await requireBoardWritable(boardScopedReq, boardId);
  if (writableError) return writableError;

  const board = boardScopedReq.board!;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const guestError = guestGuard(scopedReq);
  if (guestError) return guestError;

  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  let body: { title?: string; monetization_type?: MonetizationType | null; visibility?: BoardVisibility; description?: string | null; background?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim() === '') {
      return Response.json(
        { error: { code: 'bad-request', message: 'title must be a non-empty string' } },
        { status: 400 },
      );
    }
    updates.title = body.title.trim();
  }

  if ('monetization_type' in body) {
    if (!VALID_MONETIZATION_TYPES.includes(body.monetization_type as MonetizationType | null)) {
      return Response.json(
        {
          name: 'bad-request',
          data: { message: "monetization_type must be null, 'pre-paid', or 'pay-to-paid'" },
        },
        { status: 400 },
      );
    }
    updates.monetization_type = body.monetization_type ?? null;
  }

  if (body.visibility !== undefined) {
    if (!VALID_VISIBILITY.includes(body.visibility)) {
      return Response.json(
        { error: { code: 'bad-request', message: "visibility must be 'PUBLIC', 'PRIVATE', or 'WORKSPACE'" } },
        { status: 400 },
      );
    }
    updates.visibility = body.visibility;
  }

  if ('description' in body) {
    updates.description = body.description?.trim() ?? null;
  }

  if ('background' in body) {
    updates.background = body.background?.trim() ?? null;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json(
      { error: { code: 'bad-request', message: 'No valid fields provided for update' } },
      { status: 400 },
    );
  }

  const [updated] = await db('boards').where({ id: boardId }).update(updates, ['*']);

  await writeEvent({
    type: 'board_updated',
    boardId,
    entityId: boardId,
    actorId: (req as AuthenticatedRequest).currentUser?.id ?? 'system',
    payload: updates,
  });

  return Response.json({ data: updated });
}
