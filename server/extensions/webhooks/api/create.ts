// POST /api/v1/webhooks — register a new webhook.
// signing_secret is returned exactly once in this response, never again.
import { randomBytes, randomUUID } from 'node:crypto';
import { encryptSecret } from '../../../common/crypto';
import { db } from '../../../common/db';
import { env } from '../../../config/env';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { WEBHOOK_EVENT_TYPES, type WebhookEventType } from '../common/eventTypes';
import { isEndpointAllowed } from './ssrfGuard';

export async function handleCreateWebhook(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  let body: {
    label?: string;
    endpointUrl?: string;
    eventTypes?: WebhookEventType[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const { label, endpointUrl, eventTypes } = body;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  if (!label || typeof label !== 'string' || label.trim() === '') {
    return Response.json(
      { name: 'bad-request', data: { message: 'label is required' } },
      { status: 400 },
    );
  }

  if (!endpointUrl || typeof endpointUrl !== 'string') {
    return Response.json(
      { name: 'bad-request', data: { message: 'endpointUrl is required' } },
      { status: 400 },
    );
  }

  if (!Array.isArray(eventTypes) || eventTypes.length === 0) {
    return Response.json(
      { name: 'bad-request', data: { message: 'eventTypes must be a non-empty array' } },
      { status: 400 },
    );
  }

  const invalidTypes = eventTypes.filter((t) => !(WEBHOOK_EVENT_TYPES as readonly string[]).includes(t));
  if (invalidTypes.length > 0) {
    return Response.json(
      { name: 'invalid-event-types', data: { message: `Unknown event types: ${invalidTypes.join(', ')}` } },
      { status: 400 },
    );
  }

  // [why] SSRF guard — rejects non-https URLs and private IP ranges
  const allowed = await isEndpointAllowed(endpointUrl);
  if (!allowed) {
    return Response.json(
      { name: 'endpoint-url-not-allowed', data: { message: 'endpointUrl must be an https:// URL pointing to a public host' } },
      { status: 422 },
    );
  }

  const signingSecret = randomBytes(32).toString('hex');
  // [why] encrypt before persisting — DB dump alone cannot reconstruct the secret
  const encryptedSecret = encryptSecret({
    plaintext: signingSecret,
    hexKey: env.WEBHOOK_SECRET_ENCRYPTION_KEY,
  });
  const id = randomUUID();
  const now = new Date().toISOString();

  await db('webhooks').insert({
    id,
    created_by: userId,
    label: label.trim(),
    endpoint_url: endpointUrl,
    signing_secret: encryptedSecret,
    event_types: JSON.stringify(eventTypes),
    is_active: true,
    created_at: now,
    updated_at: now,
  });

  return Response.json(
    {
      data: {
        id,
        label: label.trim(),
        endpointUrl,
        eventTypes,
        isActive: true,
        createdAt: now,
        // [why] signingSecret returned once only — never exposed in list/get endpoints
        signingSecret,
      },
    },
    { status: 201 },
  );
}
