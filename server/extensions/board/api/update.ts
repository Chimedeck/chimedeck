// PATCH /api/v1/boards/:id — rename a board; min role: ADMIN.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireBoardWritable, type BoardScopedRequest } from '../middlewares/requireBoardWritable';
import { writeEvent } from '../../../mods/events/write';
import { sanitizeText } from '../../../common/sanitize';

export async function handleUpdateBoard(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardScopedReq = req as BoardScopedRequest;
  const writableError = await requireBoardWritable(boardScopedReq, boardId);
  if (writableError) return writableError;

  const board = boardScopedReq.board!;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  let body: { title?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    return Response.json(
      { error: { code: 'bad-request', message: 'title is required' } },
      { status: 400 },
    );
  }

  const sanitizedTitle = sanitizeText(body.title.trim());
  const updated = await db('boards')
    .where({ id: boardId })
    .update({ title: sanitizedTitle }, ['*']);

  // Stub event emission.
  await writeEvent({ type: 'board_renamed', boardId, entityId: boardId, actorId: (req as AuthenticatedRequest).currentUser?.id ?? 'system', payload: { title: sanitizedTitle } });

  return Response.json({ data: updated[0] });
}
