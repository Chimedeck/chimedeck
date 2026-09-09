// PATCH /api/v1/webhooks/:id — update label, endpointUrl, eventTypes, or isActive.
// Caller must be the webhook owner or a workspace OWNER/ADMIN.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  hasRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { WEBHOOK_EVENT_TYPES, type WebhookEventType } from '../common/eventTypes';
import { isEndpointAllowed } from './ssrfGuard';

// Read projection from migrations 0106/0107 — workspace_id is nullable since
// webhooks became global; created_by remains required.
interface WebhookRow {
  id: string;
  workspace_id: string | null;
  created_by: string;
  label: string;
  endpoint_url: string;
  event_types: unknown;
  is_active: boolean;
  created_at: Date;
}

interface WebhookUpdateProjection {
  id: string;
  label: string;
  endpoint_url: string;
  event_types: unknown;
  is_active: boolean;
  created_at: Date;
}

export async function handleUpdateWebhook(req: Request, webhookId: string): Promise<Response> {
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
      { name: 'insufficient-permissions', data: { message: 'Only the webhook owner or an admin can update this webhook' } },
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

  const updated = await db<WebhookUpdateProjection>('webhooks')
    .where({ id: webhookId })
    .select('id', 'label', 'endpoint_url', 'event_types', 'is_active', 'created_at')
    .first();
  if (!updated) {
    // [why] row was just confirmed to exist and updated above; this branch is
    // unreachable in practice but keeps the projection read type-safe.
    return Response.json(
      { name: 'webhook-not-found', data: { message: 'Webhook not found' } },
      { status: 404 },
    );
  }

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
