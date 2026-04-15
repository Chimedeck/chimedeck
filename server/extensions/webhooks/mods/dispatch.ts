// [why] fire-and-forget — webhook delivery must not block the originating request.
// A delivery row is persisted immediately so failures can be audited later.
import type { Knex } from 'knex';
import type { WebhookEventType } from '../common/eventTypes';
import { buildSignatureHeader } from './sign';

interface DispatchWebhookParams {
  endpoint: string;
  signingSecret: string;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
  webhookId: string;
  knex: Knex;
}

export async function dispatchWebhook({
  endpoint,
  signingSecret,
  eventType,
  payload,
  webhookId,
  knex,
}: DispatchWebhookParams): Promise<void> {
  const body = JSON.stringify({ event: eventType, data: payload });
  const signature = buildSignatureHeader({ secret: signingSecret, body });

  // Insert delivery row synchronously so even a failed HTTP attempt is recorded.
  const [row] = await knex('webhook_deliveries')
    .insert({
      webhook_id: webhookId,
      event_type: eventType,
      payload,
      status: 'pending',
    })
    .returning('id');

  const deliveryId = row.id;

  // [why] async IIFE so we never await the fetch at the call site — truly fire-and-forget.
  // The outer try/catch ensures ALL errors (including DB update failures) are swallowed silently.
  (async () => {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Webhook-Signature': signature,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      await knex('webhook_deliveries').where({ id: deliveryId }).update({
        status: res.ok ? 'delivered' : 'failed',
        http_status: res.status,
        response_body: (await res.text()).slice(0, 2000),
        delivered_at: new Date(),
      });
    } catch {
      // [why] silently update status to failed — delivery errors must not propagate to callers.
      try {
        await knex('webhook_deliveries').where({ id: deliveryId }).update({ status: 'failed' });
      } catch {
        // Swallow DB update errors too — delivery must never surface errors to the caller.
      }
    }
  })();
}
