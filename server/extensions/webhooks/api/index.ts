// Webhooks API router — mounts all /api/v1/webhooks routes.
import { handleListWebhooks } from './list';
import { handleCreateWebhook } from './create';
import { handleUpdateWebhook } from './update';
import { handleDeleteWebhook } from './delete';
import { handleListEventTypes } from './eventTypes';
import { env } from '../../../config/env';

// Returns a Response if the path matches a webhooks route, otherwise null.
export async function webhooksRouter(req: Request, pathname: string): Promise<Response | null> {
  // [why] feature flag gates all webhook routes — off by default in local dev
  if (!env.WEBHOOKS_ENABLED) {
    if (!pathname.startsWith('/api/v1/webhooks')) return null;
    return new Response(JSON.stringify({ name: 'not-implemented', data: { message: 'Webhooks feature is not enabled' } }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // GET /api/v1/webhooks/event-types — must match before the /:id pattern
  if (pathname === '/api/v1/webhooks/event-types' && req.method === 'GET') {
    return handleListEventTypes(req);
  }

  // GET /api/v1/webhooks — list webhooks for a workspace
  if (pathname === '/api/v1/webhooks' && req.method === 'GET') {
    return handleListWebhooks(req);
  }

  // POST /api/v1/webhooks — register a new webhook
  if (pathname === '/api/v1/webhooks' && req.method === 'POST') {
    return handleCreateWebhook(req);
  }

  // PATCH /api/v1/webhooks/:id — update a webhook
  const webhookMatch = pathname.match(/^\/api\/v1\/webhooks\/([^/]+)$/);
  if (webhookMatch) {
    const webhookId = webhookMatch[1] as string;

    if (req.method === 'PATCH') return handleUpdateWebhook(req, webhookId);
    if (req.method === 'DELETE') return handleDeleteWebhook(req, webhookId);
  }

  return null;
}
