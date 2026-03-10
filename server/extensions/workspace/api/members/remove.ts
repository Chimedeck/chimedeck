// DELETE /api/v1/workspaces/:id/members/:userId — remove member; min role: ADMIN.
// Invariant: cannot remove the last OWNER.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';

export async function handleRemoveMember(
  req: Request,
  workspaceId: string,
  userId: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, workspaceId);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  const targetMembership = await db('memberships')
    .where({ user_id: userId, workspace_id: workspaceId })
    .first();

  if (!targetMembership) {
    return Response.json(
      { error: { code: 'member-not-found', message: 'User is not a member of this workspace' } },
      { status: 404 },
    );
  }

  // Invariant: workspace must always have ≥ 1 OWNER.
  if (targetMembership.role === 'OWNER') {
    const ownerCount = await db('memberships')
      .where({ workspace_id: workspaceId, role: 'OWNER' })
      .count('user_id as count')
      .first();

    if (Number(ownerCount?.count ?? 0) <= 1) {
      return Response.json(
        { error: { code: 'workspace-must-have-one-owner', message: 'A workspace must always have at least one Owner. Promote another member first.' } },
        { status: 422 },
      );
    }
  }

  await db('memberships').where({ user_id: userId, workspace_id: workspaceId }).del();

  return new Response(null, { status: 204 });
}
