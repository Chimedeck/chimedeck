// DELETE /api/v1/webhooks/:id — remove a webhook; caller must be the owner.
// webhook_deliveries are cascade-deleted by DB foreign key constraint.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { canManageWebhook } from './mods/webhookPermissions';

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

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  if (!canManageWebhook({ webhookCreatedBy: webhook.created_by, currentUserId: userId })) {
    return Response.json(
      { name: 'insufficient-permissions', data: { message: 'Only the webhook owner can delete this webhook' } },
      { status: 403 },
    );
  }

  await db('webhooks').where({ id: webhookId }).del();

  return Response.json({ data: {} });
}
