// GET /api/v1/workspaces/:id/members — list workspace members; min role: VIEWER.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';

export async function handleListMembers(req: Request, workspaceId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, workspaceId);
  if (membershipError) return membershipError;

  // VIEWER and above — membership check is sufficient.

  const members = await db('memberships')
    .join('users', 'memberships.user_id', 'users.id')
    .where('memberships.workspace_id', workspaceId)
    .select(
      db.raw('users.id as "userId"'),
      'users.email',
      db.raw('COALESCE(users.name, users.email) as name'),
      'memberships.role',
    );

  return Response.json({ data: members });
}
