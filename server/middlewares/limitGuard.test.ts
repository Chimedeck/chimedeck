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
  test('personal tier maxBoardsPerWorkspace is 1', () => {
    expect(resolveQuota('tier_1', 'maxBoardsPerWorkspace')).toBe(1);
  });

  test('hobby tier maxBoardsPerWorkspace is 10', () => {
    expect(resolveQuota('tier_2', 'maxBoardsPerWorkspace')).toBe(10);
  });

  test('pro tier maxBoardsPerWorkspace is 30', () => {
    expect(resolveQuota('tier_3', 'maxBoardsPerWorkspace')).toBe(30);
  });

  test('business tier maxBoardsPerWorkspace is 200', () => {
    expect(resolveQuota('tier_4', 'maxBoardsPerWorkspace')).toBe(200);
  });

  test('enterprise tier maxBoardsPerWorkspace is unlimited', () => {
    expect(resolveQuota('unlimited', 'maxBoardsPerWorkspace')).toBe('unlimited');
  });

  test('personal tier maxColumnsPerBoard is 10', () => {
    expect(resolveQuota('tier_1', 'maxColumnsPerBoard')).toBe(10);
  });

  test('business tier maxColumnsPerBoard is 20', () => {
    expect(resolveQuota('tier_4', 'maxColumnsPerBoard')).toBe(20);
  });

  test('enterprise tier maxColumnsPerBoard is unlimited', () => {
    expect(resolveQuota('unlimited', 'maxColumnsPerBoard')).toBe('unlimited');
  });

  test('unknown tier falls back to personal', () => {
    // Cast to bypass type narrowing — simulates corrupt data from DB.
    const quota = resolveQuota('bad_tier' as SubscriptionTier, 'maxBoardsPerWorkspace');
    expect(quota).toBe(SUBSCRIPTION_TIERS.personal.maxBoardsPerWorkspace);
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

    test('business tier maxBoardsTotal is unlimited — never returns 402', () => {
      expect(buildLimitResponse('tier_4', 'maxBoardsTotal', 999, 'workspace-1')).toBeNull();
    });
  });

  describe('numeric quota — below limit', () => {
    test('returns null when usage is 0 out of 1 (personal maxBoardsPerWorkspace)', () => {
      expect(buildLimitResponse('tier_1', 'maxBoardsPerWorkspace', 0, 'workspace-1')).toBeNull();
    });

    test('returns null when usage is 9 out of 10 (personal maxColumnsPerBoard)', () => {
      expect(buildLimitResponse('tier_1', 'maxColumnsPerBoard', 9, 'workspace-1')).toBeNull();
    });
  });

  describe('numeric quota — at or above limit', () => {
    test('returns 402 when usage exceeds quota (personal maxBoardsPerWorkspace = 1)', async () => {
      const res = buildLimitResponse('tier_1', 'maxBoardsPerWorkspace', 2, 'workspace-1');
      expect(res).not.toBeNull();
      expect(res!.status).toBe(402);

      const body = (await res!.json());
      expect(body.error.code).toBe('limit-reached');
      expect(body.error.data.limit).toBe('maxBoardsPerWorkspace');
      expect(body.error.data.currentUsage).toBe(2);
      expect(body.error.data.quota).toBe(1);
    });

    test('returns 402 when at column cap (personal maxColumnsPerBoard = 10)', () => {
      expect(buildLimitResponse('tier_1', 'maxColumnsPerBoard', 10, 'workspace-1')).not.toBeNull();
    });

    test('response body has error.code = limit-reached', async () => {
      const res = buildLimitResponse('tier_1', 'maxBoardsPerWorkspace', 1, 'workspace-1');
      const body = (await res!.json());
      expect(body.error.code).toBe('limit-reached');
    });

    test('personal quota is reported as a number', async () => {
      const res = buildLimitResponse('tier_1', 'maxBoardsPerWorkspace', 1, 'workspace-1');
      const body = (await res!.json());
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
