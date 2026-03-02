// POST /api/v1/boards/:boardId/lists — create a new list; min role: MEMBER.
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireBoardWritable, type BoardScopedRequest } from '../../board/middlewares/requireBoardWritable';
import { between, HIGH_SENTINEL } from '../mods/fractional';

export async function handleCreateList(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const writableError = await requireBoardWritable(boardReq, boardId);
  if (writableError) return writableError;

  const board = boardReq.board!;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  let body: { title?: string; afterId?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    return Response.json(
      { name: 'bad-request', data: { message: 'title is required' } },
      { status: 400 },
    );
  }

  // Resolve position: insert after the specified list (or at the end)
  const activeLists = await db('lists')
    .where({ board_id: boardId, archived: false })
    .orderBy('position', 'asc');

  let position: string;
  if (body.afterId === null || body.afterId === undefined) {
    // Append to end
    const last = activeLists[activeLists.length - 1];
    position = between(last ? last.position : '', HIGH_SENTINEL);
  } else {
    const afterIndex = activeLists.findIndex((l) => l.id === body.afterId);
    if (afterIndex === -1) {
      return Response.json(
        { name: 'list-not-found', data: { message: 'afterId list not found' } },
        { status: 404 },
      );
    }
    const after = activeLists[afterIndex]!;
    const next = activeLists[afterIndex + 1];
    position = between(after.position, next ? next.position : HIGH_SENTINEL);
  }

  const id = randomUUID();
  await db('lists').insert({
    id,
    board_id: boardId,
    title: body.title.trim(),
    position,
    archived: false,
  });

  const list = await db('lists').where({ id }).first();

  // Stub event emission — replaced by activity log in sprint 10.
  console.log('[event] list_created', { listId: id, boardId });

  return Response.json({ data: list }, { status: 201 });
}
