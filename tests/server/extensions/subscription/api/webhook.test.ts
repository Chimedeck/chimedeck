import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { createHmac } from 'node:crypto';

let subscriptionsEnabled = true;
let webhookSecret = 'whsec_test_secret';
const seenEventIds = new Set<string>();

mock.module('../../../../../server/config/env', () => ({
  env: {
    get SUBSCRIPTIONS_ENABLED() {
      return subscriptionsEnabled;
    },
    get STRIPE_WEBHOOK_SECRET() {
      return webhookSecret;
    },
  },
}));

mock.module('../../../../../server/extensions/subscription/common/syncFromStripe', () => ({
  syncSubscriptionFromStripeEvent: async ({
    event,
  }: {
    event: { id: string };
  }) => {
    if (event.id === 'evt_failed_processing') {
      throw new Error('user-id-not-found-for-stripe-subscription');
    }
    if (seenEventIds.has(event.id)) {
      return {
        processed: false,
        idempotent: true,
        ignored: false,
        userId: 'owner-1',
        tier: 'tier_2',
      };
    }
    seenEventIds.add(event.id);
    return {
      processed: true,
      idempotent: false,
      ignored: false,
      userId: 'owner-1',
      tier: 'tier_2',
    };
  },
}));

const { handleStripeWebhook } = await import('../../../../../server/extensions/subscription/api/webhook');

function createStripeSignature(rawBody: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadToSign = `${timestamp}.${rawBody}`;
  const signature = createHmac('sha256', secret).update(payloadToSign).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

describe('handleStripeWebhook', () => {
  beforeEach(() => {
    subscriptionsEnabled = true;
    webhookSecret = 'whsec_test_secret';
    seenEventIds.clear();
  });

  it('rejects webhook requests with invalid signature', async () => {
    const rawBody = JSON.stringify({
      id: 'evt_invalid_sig',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_1', customer: 'cus_1' } },
    });
    const req = new Request('http://localhost/api/subscription/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=bad' },
      body: rawBody,
    });

    const res = await handleStripeWebhook(req);
    const body = (await res.json()) as { name?: string };

    expect(res.status).toBe(400);
    expect(body.name).toBe('invalid-stripe-signature');
  });

  it('processes valid webhook and returns tier sync payload', async () => {
    const rawBody = JSON.stringify({
      id: 'evt_valid_1',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_1', customer: 'cus_1' } },
    });
    const req = new Request('http://localhost/api/subscription/webhook', {
      method: 'POST',
      headers: {
        'stripe-signature': createStripeSignature(rawBody, webhookSecret),
      },
      body: rawBody,
    });

    const res = await handleStripeWebhook(req);
    const body = (await res.json()) as { data?: { tier?: string; userId?: string; idempotent?: boolean } };

    expect(res.status).toBe(200);
    expect(body.data?.userId).toBe('owner-1');
    expect(body.data?.tier).toBe('tier_2');
    expect(body.data?.idempotent).toBe(false);
  });

  it('returns idempotent=true for replayed event ids', async () => {
    const rawBody = JSON.stringify({
      id: 'evt_replay_1',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_1', customer: 'cus_1' } },
    });
    const signature = createStripeSignature(rawBody, webhookSecret);
    const firstReq = new Request('http://localhost/api/subscription/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': signature },
      body: rawBody,
    });
    const secondReq = new Request('http://localhost/api/subscription/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': signature },
      body: rawBody,
    });

    await handleStripeWebhook(firstReq);
    const replayResponse = await handleStripeWebhook(secondReq);
    const replayPayload = (await replayResponse.json()) as { data?: { idempotent?: boolean; processed?: boolean } };

    expect(replayResponse.status).toBe(200);
    expect(replayPayload.data?.idempotent).toBe(true);
    expect(replayPayload.data?.processed).toBe(false);
  });

    it('logs event context when webhook processing fails', async () => {
      const consoleError = mock(() => {});
      const originalConsoleError = console.error;
      console.error = consoleError;

      try {
        const rawBody = JSON.stringify({
          id: 'evt_failed_processing',
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: 'sub_missing_identity',
              customer: 'cus_missing_identity',
              status: 'active',
              items: { data: [{ price: { id: 'price_tier_2' } }] },
            },
          },
        });

        const req = new Request('http://localhost/api/subscription/webhook', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'stripe-signature': createStripeSignature(rawBody, webhookSecret),
          },
          body: rawBody,
        });

        const res = await handleStripeWebhook(req);
        const payload = await res.json() as { name?: string; data?: { message?: string } };

        expect(res.status).toBe(500);
        expect(payload.name).toBe('stripe-webhook-processing-failed');
        expect(payload.data?.message).toBe('user-id-not-found-for-stripe-subscription');
        expect(consoleError).toHaveBeenCalledTimes(1);
        expect(consoleError.mock.calls[0]?.[0]).toBe('[subscription/webhook] processing failed');
        expect(consoleError.mock.calls[0]?.[1]).toMatchObject({
          eventId: 'evt_failed_processing',
          eventType: 'customer.subscription.updated',
          error: 'user-id-not-found-for-stripe-subscription',
        });
      } finally {
        console.error = originalConsoleError;
      }
    });
});
