// DELETE /api/v1/webhooks/:id — remove a webhook; caller must be owner or workspace ADMIN+.
// webhook_deliveries are cascade-deleted by DB foreign key constraint.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  hasRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

export async function handleDeleteWebhook(req: Request, webhookId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const webhook = await db('webhooks').where({ id: webhookId }).first();
  if (!webhook) {
    return Response.json(
      { name: 'webhook-not-found', data: { message: 'Webhook not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, webhook.workspace_id);
  if (membershipError) return membershipError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;
  const isOwner = webhook.created_by === userId;
  const isAdminOrAbove = scopedReq.callerRole ? hasRole(scopedReq.callerRole, 'ADMIN') : false;

  if (!isOwner && !isAdminOrAbove) {
    return Response.json(
      { name: 'insufficient-permissions', data: { message: 'Only the webhook owner or an admin can delete this webhook' } },
      { status: 403 },
    );
  }

  await db('webhooks').where({ id: webhookId }).del();

  return Response.json({ data: {} });
}
