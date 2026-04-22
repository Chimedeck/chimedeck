// PATCH /api/v1/webhooks/:id — update label, endpointUrl, eventTypes, or isActive.
// Caller must be the webhook owner.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { WEBHOOK_EVENT_TYPES, type WebhookEventType } from '../common/eventTypes';
import { canManageWebhook } from './mods/webhookPermissions';
import { isEndpointAllowed } from './ssrfGuard';

export async function handleUpdateWebhook(req: Request, webhookId: string): Promise<Response> {
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
      { name: 'insufficient-permissions', data: { message: 'Only the webhook owner can update this webhook' } },
      { status: 403 },
    );
  }

  let body: {
    label?: string;
    endpointUrl?: string;
    eventTypes?: WebhookEventType[];
    isActive?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.label !== undefined) {
    if (typeof body.label !== 'string' || body.label.trim() === '') {
      return Response.json(
        { name: 'bad-request', data: { message: 'label must be a non-empty string' } },
        { status: 400 },
      );
    }
    updates['label'] = body.label.trim();
  }

  if (body.endpointUrl !== undefined) {
    const allowed = await isEndpointAllowed(body.endpointUrl);
    if (!allowed) {
      return Response.json(
        { name: 'endpoint-url-not-allowed', data: { message: 'endpointUrl must be an https:// URL pointing to a public host' } },
        { status: 422 },
      );
    }
    updates['endpoint_url'] = body.endpointUrl;
  }

  if (body.eventTypes !== undefined) {
    if (!Array.isArray(body.eventTypes) || body.eventTypes.length === 0) {
      return Response.json(
        { name: 'bad-request', data: { message: 'eventTypes must be a non-empty array' } },
        { status: 400 },
      );
    }
    const invalidTypes = body.eventTypes.filter((t) => !(WEBHOOK_EVENT_TYPES as readonly string[]).includes(t));
    if (invalidTypes.length > 0) {
      return Response.json(
        { name: 'invalid-event-types', data: { message: `Unknown event types: ${invalidTypes.join(', ')}` } },
        { status: 400 },
      );
    }
    updates['event_types'] = JSON.stringify(body.eventTypes);
  }

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') {
      return Response.json(
        { name: 'bad-request', data: { message: 'isActive must be a boolean' } },
        { status: 400 },
      );
    }
    updates['is_active'] = body.isActive;
  }

  await db('webhooks').where({ id: webhookId }).update(updates);

  const updated = await db('webhooks')
    .where({ id: webhookId })
    .select('id', 'label', 'endpoint_url', 'event_types', 'is_active', 'created_at')
    .first();

  return Response.json({
    data: {
      id: updated.id,
      label: updated.label,
      endpointUrl: updated.endpoint_url,
      eventTypes: updated.event_types,
      isActive: updated.is_active,
      createdAt: updated.created_at,
    },
  });
}
