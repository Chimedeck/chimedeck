// DELETE /api/v1/labels/:id — delete label (cascades to card_labels); min role: ADMIN.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

export async function handleDeleteLabel(req: Request, labelId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const label = await db('labels').where({ id: labelId }).first();
  if (!label) {
    return Response.json(
      { error: { code: 'label-not-found', message: 'Label not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, label.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  // CASCADE via FK: card_labels rows are deleted automatically
  await db('labels').where({ id: labelId }).delete();

  return new Response(null, { status: 204 });
}
