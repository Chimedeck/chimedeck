// GET  /api/v1/boards/:id/labels — list labels for the board.
// POST /api/v1/boards/:id/labels — create a label scoped to the board.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { guestGuard } from '../../../middlewares/guestGuard';
import { requireBoardAccess, type BoardScopedRequest } from '../middlewares/requireBoardAccess';
import {
  applyBoardVisibility,
  type BoardVisibilityScopedRequest,
} from '../../../middlewares/boardVisibility';
import { randomUUID } from 'crypto';
import { resolveBoardId } from '../../../common/ids/resolveEntityId';

export async function handleGetBoardLabels(req: Request, boardId: string): Promise<Response> {
  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;

  const scopedReq = req as BoardVisibilityScopedRequest;
  const board = scopedReq.board!;

  if (board.visibility !== 'PUBLIC') {
    const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
    if (membershipError) return membershipError;
  }

  const labels = await db('labels')
    .where({ board_id: board.id })
    .orderBy('name', 'asc');

  return Response.json({ data: labels });
}

export async function handleCreateBoardLabel(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const resolvedBoardId = await resolveBoardId(boardId);
  if (!resolvedBoardId) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 }
    );
  }

  const boardReq = req as BoardScopedRequest;
  const accessError = await requireBoardAccess(boardReq, resolvedBoardId);
  if (accessError) return accessError;

  const board = boardReq.board!;
  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const guestError = guestGuard(scopedReq);
  if (guestError) return guestError;

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  let body: { name: string; color: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 }
    );
  }

  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
    return Response.json(
      { error: { code: 'bad-request', message: 'name is required' } },
      { status: 400 }
    );
  }

  const label = {
    id: randomUUID(),
    board_id: board.id,
    name: body.name.trim(),
    color: body.color ?? '#6b7280',
  };

  await db('labels').insert(label);
  return Response.json({ data: label }, { status: 201 });
}
