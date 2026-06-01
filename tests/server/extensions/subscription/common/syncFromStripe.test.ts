import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { WorkspaceSubscription } from '../../../../../server/extensions/subscription/common/types';

let subscriptions = new Map<string, WorkspaceSubscription>();
let processedEventIds = new Set<string>();

mock.module('../../../../../server/config/env', () => ({
  env: {
    STRIPE_PRICE_TIER_2: 'price_tier_2',
    STRIPE_PRICE_TIER_3: 'price_tier_3',
    STRIPE_PRICE_TIER_4: 'price_tier_4',
  },
}));

mock.module('../../../../../server/extensions/subscription/common/subscriptionRepo', () => ({
  getByWorkspaceId: async (workspaceId: string) => subscriptions.get(workspaceId) ?? null,
  getByStripeCustomerId: async (stripeCustomerId: string) => {
    for (const subscription of subscriptions.values()) {
      if (subscription.stripeCustomerId === stripeCustomerId) return subscription;
    }
    return null;
  },
  getByStripeSubscriptionId: async (stripeSubscriptionId: string) => {
    for (const subscription of subscriptions.values()) {
      if (subscription.stripeSubscriptionId === stripeSubscriptionId) return subscription;
    }
    return null;
  },
  upsertStripeSubscriptionState: async (input: {
    workspaceId: string;
    tier: WorkspaceSubscription['tier'];
    status: WorkspaceSubscription['status'];
    stripeCustomerId: string;
    stripeSubscriptionId: string | null;
    stripePriceId: string | null;
    stripeCurrentPeriodEnd: string | null;
  }) => {
    const existing = subscriptions.get(input.workspaceId);
    const next: WorkspaceSubscription = {
      workspaceId: input.workspaceId,
      tier: input.tier,
      status: input.status,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      stripePriceId: input.stripePriceId,
      stripeCurrentPeriodEnd: input.stripeCurrentPeriodEnd,
      createdAt: existing?.createdAt ?? '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    };
    subscriptions.set(input.workspaceId, next);
    return next;
  },
  isStripeEventProcessed: (eventId: string) => processedEventIds.has(eventId),
  recordStripeEventProcessed: (eventId: string) => {
    processedEventIds.add(eventId);
  },
}));

const { syncSubscriptionFromStripeEvent } = await import(
  '../../../../../server/extensions/subscription/common/syncFromStripe'
);

describe('syncSubscriptionFromStripeEvent', () => {
  beforeEach(() => {
    subscriptions = new Map<string, WorkspaceSubscription>([
      [
        'ws-1',
        {
          workspaceId: 'ws-1',
          tier: 'tier_1',
          status: 'active',
          stripeCustomerId: 'cus_123',
          stripeSubscriptionId: 'sub_existing',
          stripePriceId: 'price_tier_2',
          stripeCurrentPeriodEnd: null,
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
      ],
    ]);
    processedEventIds = new Set<string>();
  });

  it('updates workspace tier/status for supported subscription events', async () => {
    const result = await syncSubscriptionFromStripeEvent({
      event: {
        id: 'evt_sub_updated_1',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_existing',
            customer: 'cus_123',
            status: 'trialing',
            current_period_end: 1_800_000_000,
            metadata: { workspaceId: 'ws-1' },
            items: { data: [{ price: { id: 'price_tier_2' } }] },
          },
        },
      },
    });

    expect(result.processed).toBe(true);
    expect(result.idempotent).toBe(false);
    expect(result.tier).toBe('tier_2');

    const updated = subscriptions.get('ws-1');
    expect(updated?.tier).toBe('tier_2');
    expect(updated?.status).toBe('trialing');
    expect(updated?.stripePriceId).toBe('price_tier_2');
  });

  it('falls back to tier_1 when price id is missing or unknown', async () => {
    const result = await syncSubscriptionFromStripeEvent({
      event: {
        id: 'evt_unknown_price',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_existing',
            customer: 'cus_123',
            status: 'active',
            metadata: { workspaceId: 'ws-1' },
            items: { data: [{ price: { id: 'price_unknown' } }] },
          },
        },
      },
    });

    expect(result.tier).toBe('tier_1');
    expect(subscriptions.get('ws-1')?.tier).toBe('tier_1');
  });

  it('handles deletion events by downgrading to tier_1', async () => {
    const result = await syncSubscriptionFromStripeEvent({
      event: {
        id: 'evt_deleted_1',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_existing',
            customer: 'cus_123',
            metadata: { workspaceId: 'ws-1' },
          },
        },
      },
    });

    expect(result.processed).toBe(true);
    expect(subscriptions.get('ws-1')?.tier).toBe('tier_1');
    expect(subscriptions.get('ws-1')?.status).toBe('canceled');
  });

  it('is idempotent when the same event is replayed', async () => {
    const first = await syncSubscriptionFromStripeEvent({
      event: {
        id: 'evt_replay_1',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_existing',
            customer: 'cus_123',
            status: 'active',
            metadata: { workspaceId: 'ws-1' },
            items: { data: [{ price: { id: 'price_tier_2' } }] },
          },
        },
      },
    });

    const second = await syncSubscriptionFromStripeEvent({
      event: {
        id: 'evt_replay_1',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_existing',
            customer: 'cus_123',
            status: 'active',
            metadata: { workspaceId: 'ws-1' },
            items: { data: [{ price: { id: 'price_tier_2' } }] },
          },
        },
      },
    });

    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(second.processed).toBe(false);
  });

  it('ignores unsupported event types', async () => {
    const result = await syncSubscriptionFromStripeEvent({
      event: {
        id: 'evt_ignored_1',
        type: 'invoice.paid',
        data: { object: {} },
      },
    });

    expect(result.ignored).toBe(true);
    expect(result.processed).toBe(false);
  });
});
