// DELETE /api/v1/webhooks/:id — remove a webhook; caller must be owner or workspace ADMIN+.
// webhook_deliveries are cascade-deleted by DB foreign key constraint.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  hasRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

// Read projection from migrations 0106/0107 — workspace_id is nullable since
// webhooks became global; created_by remains required.
interface WebhookRow {
  id: string;
  workspace_id: string | null;
  created_by: string;
}

export async function handleDeleteWebhook(req: Request, webhookId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const webhook = await db<WebhookRow>('webhooks').where({ id: webhookId }).first();
  if (!webhook) {
    return Response.json(
      { name: 'webhook-not-found', data: { message: 'Webhook not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  // [preserve] webhook.workspace_id can be null since migration 0107 made webhooks
  // global; requireWorkspaceMembership's parameter type is widened here to match
  // the unchanged runtime call, not to alter behaviour for null workspace_id.
  const membershipError = await requireWorkspaceMembership(
    scopedReq,
    webhook.workspace_id as string,
  );
  if (membershipError) return membershipError;

  const currentUser = (req as AuthenticatedRequest).currentUser;
  if (!currentUser) {
    return Response.json(
      { error: { code: 'unauthorized', message: 'Authentication required' } },
      { status: 401 },
    );
  }
  const userId = currentUser.id;
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
