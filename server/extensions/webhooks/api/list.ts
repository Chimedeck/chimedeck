// GET /api/v1/webhooks — list all registered webhooks.
// signing_secret is never returned.
import { db } from '../../../common/db';
import { authenticate } from '../../auth/middlewares/authentication';
import type { AuthenticatedRequest } from '../../auth/middlewares/authentication';

// Read projection from migrations 0106/0107; the registry is global.
interface WebhookListRow {
  id: string;
  label: string;
  endpoint_url: string;
  event_types: unknown;
  is_active: boolean;
  created_at: Date;
}

export async function handleListWebhooks(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const rows = await db<WebhookListRow>('webhooks')
    .where({ is_active: true })
    .orderBy('created_at', 'desc')
    .select('id', 'label', 'endpoint_url', 'event_types', 'is_active', 'created_at');

  return Response.json({
    data: rows.map((r) => ({
      id: r.id,
      label: r.label,
      endpointUrl: r.endpoint_url,
      eventTypes: r.event_types,
      isActive: r.is_active,
      createdAt: r.created_at,
    })),
  });
}
