import { beforeEach, afterEach, describe, expect, test, mock } from 'bun:test';
import type { SubscriptionTier } from '../extensions/subscription/common/types';

let subscriptionsEnabled = true;

const getCurrentTierMock = mock(async () => 'tier_1' as SubscriptionTier);

mock.module('../config/env', () => ({
  env: {
    get SUBSCRIPTIONS_ENABLED() {
      return subscriptionsEnabled;
    },
  },
}));

mock.module('../extensions/subscription/common/subscriptionRepo', () => ({
  getCurrentTier: getCurrentTierMock,
}));

const {
  resolveQuota,
  buildLimitResponse,
  applyLimitGuard,
} = await import('./limitGuard');

import { SUBSCRIPTION_TIERS } from '../config/subscription-tiers';

// ---------------------------------------------------------------------------
// resolveQuota — maps tier + limitKey to quota value
// ---------------------------------------------------------------------------

describe('resolveQuota', () => {
  test('free tier maxBoardsPerWorkspace is 5', () => {
    expect(resolveQuota('tier_1', 'maxBoardsPerWorkspace')).toBe(5);
  });

  test('pro tier maxBoardsPerWorkspace is 50', () => {
    expect(resolveQuota('tier_2', 'maxBoardsPerWorkspace')).toBe(50);
  });

  test('enterprise tier maxBoardsPerWorkspace is unlimited', () => {
    expect(resolveQuota('unlimited', 'maxBoardsPerWorkspace')).toBe('unlimited');
  });

  test('free tier maxColumnsPerBoard is 10', () => {
    expect(resolveQuota('tier_1', 'maxColumnsPerBoard')).toBe(10);
  });

  test('pro tier maxColumnsPerBoard is unlimited', () => {
    expect(resolveQuota('tier_2', 'maxColumnsPerBoard')).toBe('unlimited');
  });

  test('enterprise tier maxColumnsPerBoard is unlimited', () => {
    expect(resolveQuota('unlimited', 'maxColumnsPerBoard')).toBe('unlimited');
  });

  test('unknown tier falls back to free', () => {
    // Cast to bypass type narrowing — simulates corrupt data from DB.
    const quota = resolveQuota('bad_tier' as SubscriptionTier, 'maxBoardsPerWorkspace');
    expect(quota).toBe(SUBSCRIPTION_TIERS.free.maxBoardsPerWorkspace);
  });
});

// ---------------------------------------------------------------------------
// buildLimitResponse — returns null when within quota, 402 Response when exceeded
// ---------------------------------------------------------------------------

describe('buildLimitResponse', () => {
  describe('unlimited quota', () => {
    const limitKeys = ['maxBoardsPerWorkspace', 'maxColumnsPerBoard'] as const;

    for (const key of limitKeys) {
      test(`enterprise tier ${key} — never returns 402`, () => {
        expect(buildLimitResponse('unlimited', key, 999_999, 'workspace-1')).toBeNull();
        expect(buildLimitResponse('unlimited', key, 0, 'workspace-1')).toBeNull();
        expect(buildLimitResponse('unlimited', key, Number.MAX_SAFE_INTEGER, 'workspace-1')).toBeNull();
      });
    }

    test('pro tier maxBoardsTotal is unlimited — never returns 402', () => {
      expect(buildLimitResponse('tier_2', 'maxBoardsTotal', 999, 'workspace-1')).toBeNull();
    });

    test('pro tier maxColumnsPerBoard is unlimited — never returns 402', () => {
      expect(buildLimitResponse('tier_2', 'maxColumnsPerBoard', 999, 'workspace-1')).toBeNull();
    });
  });

  describe('numeric quota — below limit', () => {
    test('returns null when usage is 4 out of 5 (free maxBoardsPerWorkspace)', () => {
      expect(buildLimitResponse('tier_1', 'maxBoardsPerWorkspace', 4, 'workspace-1')).toBeNull();
    });

    test('returns null when usage is 9 out of 10 (free maxColumnsPerBoard)', () => {
      expect(buildLimitResponse('tier_1', 'maxColumnsPerBoard', 9, 'workspace-1')).toBeNull();
    });
  });

  describe('numeric quota — at or above limit', () => {
    test('returns 402 when usage exceeds quota (free maxBoardsPerWorkspace = 5)', async () => {
      const res = buildLimitResponse('tier_1', 'maxBoardsPerWorkspace', 6, 'workspace-1');
      expect(res).not.toBeNull();
      expect(res!.status).toBe(402);

      const body = (await res!.json()) as any;
      expect(body.error.code).toBe('limit-reached');
      expect(body.error.data.limit).toBe('maxBoardsPerWorkspace');
      expect(body.error.data.currentUsage).toBe(6);
      expect(body.error.data.quota).toBe(5);
    });

    test('returns 402 when at column cap (free maxColumnsPerBoard = 10)', () => {
      expect(buildLimitResponse('tier_1', 'maxColumnsPerBoard', 10, 'workspace-1')).not.toBeNull();
    });

    test('response body has error.code = limit-reached', async () => {
      const res = buildLimitResponse('tier_1', 'maxBoardsPerWorkspace', 5, 'workspace-1');
      const body = (await res!.json()) as any;
      expect(body.error.code).toBe('limit-reached');
    });

    test('free quota is reported as a number', async () => {
      const res = buildLimitResponse('tier_1', 'maxBoardsPerWorkspace', 5, 'workspace-1');
      const body = (await res!.json()) as any;
      expect(typeof body.error.data.quota).toBe('number');
    });
  });
});

// ---------------------------------------------------------------------------
// SUBSCRIPTIONS_ENABLED bypass — guards should no-op before any tier lookup
// ---------------------------------------------------------------------------

describe('SUBSCRIPTIONS_ENABLED bypass', () => {
  beforeEach(() => {
    subscriptionsEnabled = false;
    getCurrentTierMock.mockClear();
  });

  afterEach(() => {
    subscriptionsEnabled = true;
  });

  test('applyLimitGuard returns null when subscriptions are disabled', async () => {
    const res = await applyLimitGuard({
      workspaceId: 'workspace-1',
      limitKey: 'maxBoardsPerWorkspace',
      currentUsage: 999,
    });

    expect(res).toBeNull();
    expect(getCurrentTierMock).not.toHaveBeenCalled();
  });
});
