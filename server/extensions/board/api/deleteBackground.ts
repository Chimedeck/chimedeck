// DELETE /api/v1/boards/:id/background — remove board background image.
// Clears boards.background, deletes the S3 object, and emits a WS event.
// Owner/Admin/Member may call this.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireBoardWritable, type BoardScopedRequest } from '../middlewares/requireBoardWritable';
import { deleteObject } from '../../attachment/mods/s3/deleteObject';
import { s3Config } from '../../attachment/common/config/s3';
import { writeEvent } from '../../../mods/events/write';

function extractS3KeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathname = decodeURIComponent(parsed.pathname);
    if (pathname.startsWith(`/${s3Config.bucket}/`)) {
      return pathname.slice(s3Config.bucket.length + 2);
    }
    if (
      parsed.hostname === `${s3Config.bucket}.s3.amazonaws.com` ||
      parsed.hostname.startsWith(`${s3Config.bucket}.s3.`)
    ) {
      return pathname.replace(/^\/+/, '');
    }
    return null;
  } catch {
    return null;
  }
}

export async function handleDeleteBackground(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardScopedReq = req as BoardScopedRequest;
  const writableError = await requireBoardWritable(boardScopedReq, boardId);
  if (writableError) return writableError;

  const board = boardScopedReq.board!;
  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  const existingBoard = await db('boards').where({ id: boardId }).first();
  if (!existingBoard) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  if (existingBoard.background) {
    try {
      const s3Key = extractS3KeyFromUrl(existingBoard.background);
      if (s3Key) await deleteObject({ s3Key });
    } catch {
      // Non-fatal — continue to clear the DB field regardless
    }
  }

  const [updated] = await db('boards')
    .where({ id: boardId })
    .update({ background: null }, ['*']);

  await writeEvent({
    type: 'board.background_changed',
    boardId,
    entityId: boardId,
    actorId: (req as AuthenticatedRequest).currentUser?.id ?? 'system',
    payload: { background: null },
  });

  return Response.json({ data: updated });
}
