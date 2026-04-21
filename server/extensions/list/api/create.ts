// POST /api/v1/boards/:boardId/lists — create a new list; min role: MEMBER.
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { writeEvent } from '../../../mods/events/write';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireBoardWritable, type BoardScopedRequest } from '../../board/middlewares/requireBoardWritable';
import { between, HIGH_SENTINEL } from '../mods/fractional';
import { sanitizeText } from '../../../common/sanitize';
import { generateUniqueShortId } from '../../../common/ids/shortId';

export async function handleCreateList(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const writableError = await requireBoardWritable(boardReq, boardId);
  if (writableError) return writableError;

  const board = boardReq.board!;
  const canonicalBoardId = board.id;

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

  // Resolve position: insert after the specified list (or at the end)
  const activeLists = await db('lists')
    .where({ board_id: canonicalBoardId, archived: false })
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
        { error: { code: 'list-not-found', message: 'afterId list not found' } },
        { status: 404 },
      );
    }
    const after = activeLists[afterIndex]!;
    const next = activeLists[afterIndex + 1];
    position = between(after.position, next ? next.position : HIGH_SENTINEL);
  }

  const id = randomUUID();
  const shortId = await generateUniqueShortId('lists');
  await db('lists').insert({
    id,
    short_id: shortId,
    board_id: canonicalBoardId,
    title: sanitizeText(body.title.trim()),
    position,
    archived: false,
  });

  const list = await db('lists').where({ id }).first();

  // Broadcast full list object so clients can update their local state
  await writeEvent({ type: 'list_created', boardId: canonicalBoardId, entityId: id, actorId: (req as AuthenticatedRequest).currentUser?.id ?? 'system', payload: { list } });

  return Response.json({ data: list }, { status: 201 });
}
