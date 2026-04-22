// PATCH /api/v1/lists/:id/color — update list color; min role: MEMBER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { writeEvent } from '../../../mods/events/write';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireBoardWritable, type BoardScopedRequest } from '../../board/middlewares/requireBoardWritable';

function normalizeColor(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (!/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return undefined;
  return trimmed.toUpperCase();
}

export async function handleUpdateListColor(req: Request, listId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const list = await db('lists').where({ id: listId }).first();
  if (!list) {
    return Response.json(
      { error: { code: 'list-not-found', message: 'List not found' } },
      { status: 404 },
    );
  }

  const boardReq = req as BoardScopedRequest;
  const writableError = await requireBoardWritable(boardReq, list.board_id);
  if (writableError) return writableError;

  const board = boardReq.board!;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  let body: { color?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const normalizedColor = normalizeColor(body.color);
  if (normalizedColor === undefined) {
    return Response.json(
      { error: { code: 'bad-request', message: 'color must be null or a hex color like #FF0000' } },
      { status: 400 },
    );
  }

  const [updated] = await db('lists')
    .where({ id: listId })
    .update({ color: normalizedColor }, ['*']);

  await writeEvent({
    type: 'list_updated',
    boardId: list.board_id,
    entityId: listId,
    actorId: (req as AuthenticatedRequest).currentUser?.id ?? 'system',
    payload: { list: updated },
  });

  return Response.json({ data: updated });
}
