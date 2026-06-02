// tests/integration/rateLimiter.test.ts
// Verifies sliding-window rate-limiting behaviour.
import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { FEATURE_KEYS } from '../../server/extensions/subscription/common/featureKeys';
import type { SubscriptionTier } from '../../server/extensions/subscription/common/types';
import type { RateLimiterClient } from '../../server/middlewares/rateLimiter';

let rateLimitEnabled = true;
let subscriptionsEnabled = true;
let currentTier: SubscriptionTier = 'tier_1';
let readLimit: number | 'unlimited' = 100;
let writeLimit: number | 'unlimited' = 20;

mock.module('../../server/config/env', () => ({
  env: {
    get RATE_LIMIT_ENABLED() {
      return rateLimitEnabled;
    },
    get SUBSCRIPTIONS_ENABLED() {
      return subscriptionsEnabled;
    },
    REDIS_URL: undefined,
  },
}));

mock.module('../../server/extensions/subscription/common/subscriptionRepo', () => ({
  getCurrentTier: async () => currentTier,
}));

mock.module('../../server/extensions/subscription/common/entitlements', () => ({
  resolveEntitlements: () => ({
    [FEATURE_KEYS.workspace.maxWorkspaces]: 1,
    [FEATURE_KEYS.board.maxPerWorkspace]: 5,
    [FEATURE_KEYS.board.maxTotal]: 5,
    [FEATURE_KEYS.list.maxPerBoard]: 10,
    [FEATURE_KEYS.member.maxInvitedPerBoard]: 2,
    [FEATURE_KEYS.guest.maxPerBoard]: 1,
    [FEATURE_KEYS.storage.maxBytes]: 100,
    [FEATURE_KEYS.rateLimit.readPerMinute]: readLimit,
    [FEATURE_KEYS.rateLimit.writePerMinute]: writeLimit,
  }),
}));

const {
  applyRateLimit,
  buildLegacyRateLimiterKey,
  buildWorkspaceRateLimiterKey,
  classifyLegacyRoute,
  classifyWorkspaceClass,
} = await import('../../server/middlewares/rateLimiter');

function makeClient() {
  const counts = new Map<string, number>();
  return {
    counts,
    async eval(_script: string, _numkeys: number, key: string, _ttl: string): Promise<number> {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
  } as RateLimiterClient & { counts: Map<string, number> };
}

beforeEach(() => {
  rateLimitEnabled = true;
  subscriptionsEnabled = true;
  currentTier = 'tier_1';
  readLimit = 100;
  writeLimit = 20;
});

describe('rate limiter helpers', () => {
  it('builds legacy keys from identifier + class', () => {
    const key = buildLegacyRateLimiterKey('read', 'user-123', '1.2.3.4');
    expect(key).toContain('user-123');
    expect(key).toContain('read');
  });

  it('falls back to IP for legacy keys when userId is missing', () => {
    const key = buildLegacyRateLimiterKey('mutation', undefined, '5.6.7.8');
    expect(key).toContain('5.6.7.8');
    expect(key).toContain('mutation');
  });

  it('builds workspace-scoped keys from workspace + class', () => {
    const key = buildWorkspaceRateLimiterKey('ws-1', 'write');
    expect(key).toContain('rl:ws:ws-1:write:');
  });

  it('classifies workspace requests into read/write buckets', () => {
    expect(classifyWorkspaceClass('GET')).toBe('read');
    expect(classifyWorkspaceClass('HEAD')).toBe('read');
    expect(classifyWorkspaceClass('POST')).toBe('write');
  });

  it('keeps legacy auth/upload/read/mutation classes available', () => {
    expect(classifyLegacyRoute('POST', '/api/v1/auth/login')).toBe('auth');
    expect(classifyLegacyRoute('POST', '/api/v1/cards/1/attachments')).toBe('upload');
    expect(classifyLegacyRoute('GET', '/api/v1/workspaces')).toBe('read');
    expect(classifyLegacyRoute('PATCH', '/api/v1/boards/1')).toBe('mutation');
  });
});

describe('applyRateLimit', () => {
  it('shares one workspace bucket across callers in the same workspace', async () => {
    const client = makeClient();
    const first = new Request('http://localhost/api/v1/boards/board-1', { method: 'POST' });
    const second = new Request('http://localhost/api/v1/cards/card-1', {
      method: 'POST',
      headers: { 'x-forwarded-for': '9.9.9.9' },
    });

    const firstResult = await applyRateLimit(first, { workspaceId: 'ws-1' }, client);
    const secondResult = await applyRateLimit(second, { workspaceId: 'ws-1' }, client);

    expect(firstResult).toBeNull();
    expect(secondResult).toBeNull();
    expect(client.counts.size).toBe(1);
    const [key] = client.counts.keys();
    const [count] = client.counts.values();
    expect(key).toContain('rl:ws:ws-1:write:');
    expect(count).toBe(2);
  });

  it('keeps separate buckets for different workspaces', async () => {
    const client = makeClient();

    await applyRateLimit(new Request('http://localhost/api/v1/boards/board-1', { method: 'POST' }), {
      workspaceId: 'ws-1',
    }, client);
    await applyRateLimit(new Request('http://localhost/api/v1/boards/board-2', { method: 'POST' }), {
      workspaceId: 'ws-2',
    }, client);

    expect(client.counts.size).toBe(2);
  });

  it('keeps read and write budgets independent', async () => {
    const client = makeClient();

    await applyRateLimit(new Request('http://localhost/api/v1/boards/board-1', { method: 'GET' }), {
      workspaceId: 'ws-1',
    }, client);
    await applyRateLimit(new Request('http://localhost/api/v1/boards/board-1', { method: 'POST' }), {
      workspaceId: 'ws-1',
    }, client);

    expect(client.counts.size).toBe(2);
    const keys = [...client.counts.keys()];
    expect(keys.some((key) => key.includes(':read:'))).toBe(true);
    expect(keys.some((key) => key.includes(':write:'))).toBe(true);
  });

  it('returns 429 when the workspace read limit is exceeded', async () => {
    readLimit = 1;
    const client = makeClient();

    const request = new Request('http://localhost/api/v1/boards/board-1', { method: 'GET' });
    expect(await applyRateLimit(request, { workspaceId: 'ws-1' }, client)).toBeNull();

    const response = await applyRateLimit(request, { workspaceId: 'ws-1' }, client);
    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);

    const body = (await response!.json()) as {
      error?: {
        code?: string;
        data?: {
          scope?: string;
          class?: string;
          limit?: number;
          currentTier?: string;
          retryAfterSeconds?: number;
        };
      };
    };
    expect(body.error?.code).toBe('rate-limit-exceeded');
    expect(body.error?.data?.scope).toBe('workspace');
    expect(body.error?.data?.class).toBe('read');
    expect(body.error?.data?.limit).toBe(1);
    expect(body.error?.data?.currentTier).toBe('tier_1');
  });

  it('returns 429 when the workspace write limit is exceeded', async () => {
    writeLimit = 1;
    const client = makeClient();

    const request = new Request('http://localhost/api/v1/boards/board-1', { method: 'POST' });
    expect(await applyRateLimit(request, { workspaceId: 'ws-1' }, client)).toBeNull();

    const response = await applyRateLimit(request, { workspaceId: 'ws-1' }, client);
    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
    expect(response?.headers.get('Retry-After')).toBeTruthy();
  });

  it('falls back to legacy per-identifier buckets when subscriptions are disabled', async () => {
    subscriptionsEnabled = false;
    const client = makeClient();

    await applyRateLimit(new Request('http://localhost/api/v1/boards/board-1', { method: 'POST' }), {
      workspaceId: 'ws-1',
      userId: 'user-1',
    }, client);
    await applyRateLimit(new Request('http://localhost/api/v1/boards/board-2', { method: 'POST' }), {
      workspaceId: 'ws-2',
      userId: 'user-1',
    }, client);

    expect(client.counts.size).toBe(1);
    const [key] = client.counts.keys();
    expect(key).toContain('rl:user-1:mutation:');
  });

  it('bypasses the limiter when the feature flag is disabled', async () => {
    rateLimitEnabled = false;
    const client = makeClient();

    const response = await applyRateLimit(
      new Request('http://localhost/api/v1/boards/board-1', { method: 'POST' }),
      { workspaceId: 'ws-1' },
      client,
    );

    expect(response).toBeNull();
    expect(client.counts.size).toBe(0);
  });
});
