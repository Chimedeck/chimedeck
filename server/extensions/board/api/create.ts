// POST /api/v1/workspaces/:workspaceId/boards — create a new board; min role: MEMBER.
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

import { writeEvent } from '../../../mods/events/write';

export async function handleCreateBoard(req: Request, workspaceId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, workspaceId);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  let body: { title?: string };
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

  const id = randomUUID();
  await db('boards').insert({
    id,
    workspace_id: workspaceId,
    title: body.title.trim(),
    state: 'ACTIVE',
  });

  const board = await db('boards').where({ id }).first();

  // Stub event emission — replaced by activity log in sprint 10.
  await writeEvent({ type: 'board_created', boardId: id, entityId: id, actorId: (req as AuthenticatedRequest).currentUser?.id ?? 'system', payload: { workspaceId } });

  return Response.json({ data: board }, { status: 201 });
}
