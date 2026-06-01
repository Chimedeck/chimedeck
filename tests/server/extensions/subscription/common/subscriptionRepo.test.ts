import { beforeEach, describe, expect, it, mock } from 'bun:test';

type SubscriptionRow = {
  workspace_id: string;
  tier: 'tier_1' | 'tier_2' | 'unlimited';
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'unpaid';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

let rows = new Map<string, SubscriptionRow>();
let subscriptionsEnabled = true;
let defaultUnlimitedTier = true;

class SubscriptionQueryBuilder {
  private workspaceId: string | null = null;

  where(criteria: { workspace_id: string }): SubscriptionQueryBuilder {
    this.workspaceId = criteria.workspace_id;
    return this;
  }

  async first<T>(): Promise<T | undefined> {
    if (!this.workspaceId) return undefined;
    return rows.get(this.workspaceId) as T | undefined;
  }

  async update(
    patch: Partial<SubscriptionRow>,
    returning?: ['*'],
  ): Promise<SubscriptionRow[] | number> {
    if (!this.workspaceId) return returning ? [] : 0;
    const current = rows.get(this.workspaceId);
    if (!current) return returning ? [] : 0;
    const next: SubscriptionRow = { ...current, ...patch };
    rows.set(this.workspaceId, next);
    return returning ? [next] : 1;
  }

  insert(payload: SubscriptionRow): {
    returning: (_columns: '*') => Promise<SubscriptionRow[]>;
  } {
    const inserted = { ...payload };
    rows.set(inserted.workspace_id, inserted);
    return {
      returning: async () => [inserted],
    };
  }
}

mock.module('../../../../../server/common/db', () => ({
  db: (() => new SubscriptionQueryBuilder()) as unknown as typeof import('../../../../../server/common/db').db,
}));

mock.module('../../../../../server/config/env', () => ({
  env: {
    get SUBSCRIPTIONS_ENABLED() {
      return subscriptionsEnabled;
    },
    get SUBSCRIPTIONS_DEFAULT_UNLIMITED_TIER() {
      return defaultUnlimitedTier;
    },
  },
}));

const { getCurrentTier, getByWorkspaceId, upsertWorkspaceSubscription } = await import(
  '../../../../../server/extensions/subscription/common/subscriptionRepo'
);

describe('subscriptionRepo', () => {
  beforeEach(() => {
    rows = new Map<string, SubscriptionRow>();
    subscriptionsEnabled = true;
    defaultUnlimitedTier = true;
  });

  it('returns unlimited when subscriptions are disabled', async () => {
    subscriptionsEnabled = false;
    const tier = await getCurrentTier('ws-disabled');
    expect(tier).toBe('unlimited');
  });

  it('returns workspace tier when subscriptions are enabled', async () => {
    rows.set('ws-paid', {
      workspace_id: 'ws-paid',
      tier: 'tier_2',
      status: 'active',
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_123',
      stripe_price_id: 'price_123',
      stripe_current_period_end: null,
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-01T00:00:00.000Z',
    });

    const tier = await getCurrentTier('ws-paid');
    expect(tier).toBe('tier_2');
  });

  it('falls back to tier_1 when no row exists and unlimited fallback is off', async () => {
    defaultUnlimitedTier = false;
    const tier = await getCurrentTier('ws-missing');
    expect(tier).toBe('tier_1');
  });

  it('upserts subscription rows and serializes workspace response shape', async () => {
    const created = await upsertWorkspaceSubscription({
      workspaceId: 'ws-1',
      tier: 'tier_1',
      status: 'active',
      stripeCustomerId: 'cus_abc',
    });
    expect(created.workspaceId).toBe('ws-1');
    expect(created.tier).toBe('tier_1');
    expect(created.stripeCustomerId).toBe('cus_abc');

    const updated = await upsertWorkspaceSubscription({
      workspaceId: 'ws-1',
      tier: 'unlimited',
      status: 'trialing',
      stripeCustomerId: 'cus_abc',
      stripeSubscriptionId: 'sub_abc',
    });

    expect(updated.tier).toBe('unlimited');
    expect(updated.status).toBe('trialing');
    expect(updated.stripeSubscriptionId).toBe('sub_abc');

    const loaded = await getByWorkspaceId('ws-1');
    expect(loaded?.workspaceId).toBe('ws-1');
    expect(loaded?.tier).toBe('unlimited');
  });
});
