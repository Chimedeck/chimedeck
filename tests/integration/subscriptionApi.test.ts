import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { WorkspaceContext, WorkspaceSubscription } from '../../server/extensions/subscription/common/types';

let subscriptionsEnabled = true;
let stripeSecretKey = 'sk_test_123';
let stripePriceTier2 = 'price_tier_2';
let stripePriceTier4 = 'price_tier_4';
let currentTier: WorkspaceSubscription['tier'] = 'tier_1';
let resolverResult:
  | { context: WorkspaceContext; response: null }
  | { context: null; response: Response };
let subscriptionRecord: WorkspaceSubscription | null = null;
const upsertCalls: Array<Record<string, unknown>> = [];

mock.module('../../server/config/env', () => ({
  env: {
    get SUBSCRIPTIONS_ENABLED() {
      return subscriptionsEnabled;
    },
    get STRIPE_SECRET_KEY() {
      return stripeSecretKey;
    },
    get STRIPE_PRICE_TIER_2() {
      return stripePriceTier2;
    },
    get STRIPE_PRICE_TIER_4() {
      return stripePriceTier4;
    },
    APP_URL: 'http://localhost:3000',
  },
}));

mock.module('../../server/extensions/subscription/common/workspaceResolver', () => ({
  resolveWorkspaceContext: async () => resolverResult,
}));

mock.module('../../server/extensions/subscription/common/subscriptionRepo', () => ({
  getByWorkspaceId: async () => subscriptionRecord,
  getOrCreateByWorkspaceId: async () =>
    subscriptionRecord ?? {
      workspaceId: 'ws-1',
      tier: 'tier_1',
      status: 'active',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      stripeCurrentPeriodEnd: null,
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    },
  upsertWorkspaceSubscription: async (input: Record<string, unknown>) => {
    upsertCalls.push(input);
    const next: WorkspaceSubscription = {
      workspaceId: String(input.workspaceId),
      tier: (input.tier as WorkspaceSubscription['tier']) ?? 'tier_1',
      status: (input.status as WorkspaceSubscription['status']) ?? 'active',
      stripeCustomerId: (input.stripeCustomerId as string | null | undefined) ?? null,
      stripeSubscriptionId: (input.stripeSubscriptionId as string | null | undefined) ?? null,
      stripePriceId: (input.stripePriceId as string | null | undefined) ?? null,
      stripeCurrentPeriodEnd: (input.stripeCurrentPeriodEnd as string | null | undefined) ?? null,
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    };
    subscriptionRecord = next;
    return next;
  },
  getCurrentTier: async () => currentTier,
}));

const { handleCreateCheckout } = await import('../../server/extensions/subscription/api/createCheckout');
const { handleCreatePortal } = await import('../../server/extensions/subscription/api/createPortal');
const { handleGetWorkspaceSubscription } = await import(
  '../../server/extensions/subscription/api/getWorkspaceSubscription'
);

describe('subscription API endpoints', () => {
  beforeEach(() => {
    subscriptionsEnabled = true;
    stripeSecretKey = 'sk_test_123';
    stripePriceTier2 = 'price_tier_2';
    stripePriceTier4 = 'price_tier_4';
    currentTier = 'tier_1';
    subscriptionRecord = {
      workspaceId: 'ws-1',
      tier: 'tier_1',
      status: 'active',
      stripeCustomerId: 'cus_existing',
      stripeSubscriptionId: null,
      stripePriceId: null,
      stripeCurrentPeriodEnd: null,
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    };
    resolverResult = {
      context: {
        workspaceId: 'ws-1',
        workspaceName: 'Workspace One',
        currentUserId: 'user-1',
        currentUserEmail: 'owner@example.com',
        role: 'OWNER',
      },
      response: null,
    };
    upsertCalls.length = 0;
    globalThis.fetch = mock(async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
      Response.json({ url: 'https://checkout.stripe.test/session_123' })
    ) as typeof fetch;
  });

  it('POST /api/subscription/checkout allows OWNER and returns checkout url', async () => {
    const request = new Request('http://localhost/api/subscription/checkout', {
      method: 'POST',
      body: JSON.stringify({ workspaceId: 'ws-1', tier: 'tier_2' }),
    });

    const response = await handleCreateCheckout(request);
    const payload = (await response.json()) as { data?: { url?: string } };

    expect(response.status).toBe(200);
    expect(payload.data?.url).toContain('checkout.stripe.test');
  });

  it('POST /api/subscription/checkout allows ADMIN and returns checkout url', async () => {
    resolverResult = {
      context: {
        workspaceId: 'ws-1',
        workspaceName: 'Workspace One',
        currentUserId: 'user-2',
        currentUserEmail: 'admin@example.com',
        role: 'ADMIN',
      },
      response: null,
    };
    const request = new Request('http://localhost/api/subscription/checkout', {
      method: 'POST',
      body: JSON.stringify({ workspaceId: 'ws-1', tier: 'tier_2' }),
    });

    const response = await handleCreateCheckout(request);
    expect(response.status).toBe(200);
  });

  it('POST /api/subscription/checkout rejects non-admin callers', async () => {
    resolverResult = {
      context: null,
      response: Response.json({ name: 'current-user-is-not-workspace-admin' }, { status: 403 }),
    };
    const request = new Request('http://localhost/api/subscription/checkout', {
      method: 'POST',
      body: JSON.stringify({ workspaceId: 'ws-1', tier: 'tier_2' }),
    });

    const response = await handleCreateCheckout(request);
    expect(response.status).toBe(403);
  });

  it('POST /api/subscription/portal allows OWNER and returns portal url', async () => {
    globalThis.fetch = mock(async () => Response.json({ url: 'https://billing.stripe.test/session_123' })) as typeof fetch;
    const request = new Request('http://localhost/api/subscription/portal', {
      method: 'POST',
      body: JSON.stringify({ workspaceId: 'ws-1' }),
    });

    const response = await handleCreatePortal(request);
    const payload = (await response.json()) as { data?: { url?: string } };

    expect(response.status).toBe(200);
    expect(payload.data?.url).toContain('billing.stripe.test');
  });

  it('POST /api/subscription/portal rejects non-admin callers', async () => {
    resolverResult = {
      context: null,
      response: Response.json({ name: 'current-user-is-not-workspace-admin' }, { status: 403 }),
    };
    const request = new Request('http://localhost/api/subscription/portal', {
      method: 'POST',
      body: JSON.stringify({ workspaceId: 'ws-1' }),
    });

    const response = await handleCreatePortal(request);
    expect(response.status).toBe(403);
  });

  it('GET /api/subscription allows workspace member and returns tier payload', async () => {
    resolverResult = {
      context: {
        workspaceId: 'ws-1',
        workspaceName: 'Workspace One',
        currentUserId: 'user-3',
        currentUserEmail: 'member@example.com',
        role: 'MEMBER',
      },
      response: null,
    };
    currentTier = 'tier_2';
    const request = new Request('http://localhost/api/subscription?workspaceId=ws-1');

    const response = await handleGetWorkspaceSubscription(request);
    const payload = (await response.json()) as { data?: { tier?: string; workspaceId?: string } };

    expect(response.status).toBe(200);
    expect(payload.data?.workspaceId).toBe('ws-1');
    expect(payload.data?.tier).toBe('tier_2');
  });

  it('GET /api/subscription returns workspace-not-found when workspace is missing', async () => {
    resolverResult = {
      context: null,
      response: Response.json({ name: 'workspace-not-found' }, { status: 404 }),
    };
    const request = new Request('http://localhost/api/subscription?workspaceId=ws-missing');

    const response = await handleGetWorkspaceSubscription(request);
    expect(response.status).toBe(404);
  });

  it('SUBSCRIPTIONS_ENABLED=false returns disabled responses', async () => {
    subscriptionsEnabled = false;
    currentTier = 'unlimited';

    const checkoutResponse = await handleCreateCheckout(
      new Request('http://localhost/api/subscription/checkout', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: 'ws-1' }),
      }),
    );
    const portalResponse = await handleCreatePortal(
      new Request('http://localhost/api/subscription/portal', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: 'ws-1' }),
      }),
    );
    const getResponse = await handleGetWorkspaceSubscription(
      new Request('http://localhost/api/subscription?workspaceId=ws-1'),
    );
    const getPayload = (await getResponse.json()) as { data?: { subscriptionsEnabled?: boolean; tier?: string } };

    expect(checkoutResponse.status).toBe(503);
    expect(portalResponse.status).toBe(503);
    expect(getResponse.status).toBe(200);
    expect(getPayload.data?.subscriptionsEnabled).toBe(false);
    expect(getPayload.data?.tier).toBe('unlimited');
  });
});
