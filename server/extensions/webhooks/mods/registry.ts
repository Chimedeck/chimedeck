// [why] Registry abstracts the DB query for dispatchers so they don't embed raw SQL.
// Centralising the query here ensures all callers use the same jsonb @> operator filter.
// Decryption is done here so every caller receives a ready-to-use plaintext secret.
import type { Knex } from 'knex';
import { decryptSecret } from '../../../common/crypto';
import { env } from '../../../config/env';
import type { WebhookEventType } from '../common/eventTypes';

interface ActiveWebhook {
  id: string;
  workspace_id: string;
  created_by: string;
  label: string;
  endpoint_url: string;
  signing_secret: string; // plaintext after decryption
  event_types: WebhookEventType[];
  is_active: boolean;
}

// Returns all active webhooks for a workspace that subscribe to the given event type,
// with signing_secret decrypted and ready for HMAC use.
export async function getActiveWebhooksForEvent({
  knex,
  workspaceId,
  eventType,
}: {
  knex: Knex;
  workspaceId: string;
  eventType: WebhookEventType;
}): Promise<ActiveWebhook[]> {
  const rows = await knex('webhooks')
    .where({ workspace_id: workspaceId, is_active: true })
    .whereRaw('event_types @> ?::jsonb', [JSON.stringify([eventType])]);

  // [why] decrypt here so dispatch.ts stays pure and testable with a plaintext secret
  return rows.map((wh: ActiveWebhook) => ({
    ...wh,
    signing_secret: decryptSecret({
      ciphertext: wh.signing_secret,
      hexKey: env.WEBHOOK_SECRET_ENCRYPTION_KEY,
    }),
  }));
}
