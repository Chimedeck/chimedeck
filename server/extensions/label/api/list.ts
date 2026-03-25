// GET /api/v1/workspaces/:id/labels — list all labels across all boards in the workspace; min role: VIEWER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

export async function handleListLabels(req: Request, workspaceId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const workspace = await db('workspaces').where({ id: workspaceId }).first();
  if (!workspace) {
    return Response.json(
      { error: { code: 'workspace-not-found', message: 'Workspace not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, workspaceId);
  if (membershipError) return membershipError;

  // [why] Labels are now board-scoped; join through boards to filter by workspace.
  const labels = await db('labels')
    .join('boards', 'labels.board_id', 'boards.id')
    .where('boards.workspace_id', workspaceId)
    .select('labels.*')
    .orderBy('labels.name', 'asc');

  return Response.json({ data: labels });
}
