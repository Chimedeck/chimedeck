import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';
import { resolveQuota, buildLimitResponse, type LimitKey } from './limitGuard';
import { SUBSCRIPTION_TIERS } from '../config/subscription-tiers';
import type { SubscriptionTier } from '../extensions/subscription/common/types';

// ---------------------------------------------------------------------------
// resolveQuota — maps tier + limitKey to quota value
// ---------------------------------------------------------------------------

describe('resolveQuota', () => {
  test('free tier maxWorkspaces is 1', () => {
    expect(resolveQuota('tier_1', 'maxWorkspaces')).toBe(SUBSCRIPTION_TIERS.free.maxWorkspaces);
    expect(resolveQuota('tier_1', 'maxWorkspaces')).toBe(1);
  });

  test('pro tier maxWorkspaces is 5', () => {
    expect(resolveQuota('tier_2', 'maxWorkspaces')).toBe(5);
  });

  test('enterprise tier maxWorkspaces is unlimited', () => {
    expect(resolveQuota('unlimited', 'maxWorkspaces')).toBe('unlimited');
  });

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
    const quota = resolveQuota('bad_tier' as SubscriptionTier, 'maxWorkspaces');
    expect(quota).toBe(SUBSCRIPTION_TIERS.free.maxWorkspaces);
  });
});

// ---------------------------------------------------------------------------
// buildLimitResponse — returns null when within quota, 402 Response when exceeded
// ---------------------------------------------------------------------------

describe('buildLimitResponse', () => {
  describe('unlimited quota', () => {
    const limitKeys: LimitKey[] = ['maxWorkspaces', 'maxBoardsPerWorkspace', 'maxColumnsPerBoard'];

    for (const key of limitKeys) {
      test(`enterprise tier ${key} — never returns 402`, () => {
        expect(buildLimitResponse('unlimited', key, 999_999)).toBeNull();
        expect(buildLimitResponse('unlimited', key, 0)).toBeNull();
        expect(buildLimitResponse('unlimited', key, Number.MAX_SAFE_INTEGER)).toBeNull();
      });
    }

    test('pro tier maxBoardsTotal is unlimited — never returns 402', () => {
      expect(buildLimitResponse('tier_2', 'maxBoardsTotal', 999)).toBeNull();
    });

    test('pro tier maxColumnsPerBoard is unlimited — never returns 402', () => {
      expect(buildLimitResponse('tier_2', 'maxColumnsPerBoard', 999)).toBeNull();
    });
  });

  describe('numeric quota — below limit', () => {
    test('returns null when usage is 0 out of 1 (free maxWorkspaces)', () => {
      expect(buildLimitResponse('tier_1', 'maxWorkspaces', 0)).toBeNull();
    });

    test('returns null when usage is 4 out of 5 (free maxBoardsPerWorkspace)', () => {
      expect(buildLimitResponse('tier_1', 'maxBoardsPerWorkspace', 4)).toBeNull();
    });

    test('returns null when usage is 9 out of 10 (free maxColumnsPerBoard)', () => {
      expect(buildLimitResponse('tier_1', 'maxColumnsPerBoard', 9)).toBeNull();
    });
  });

  describe('numeric quota — at or above limit', () => {
    test('returns 402 when usage equals quota (free maxWorkspaces = 1)', async () => {
      const res = buildLimitResponse('tier_1', 'maxWorkspaces', 1);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(402);

      const body = await res!.json() as any;
      expect(body.error.code).toBe('limit-reached');
      expect(body.error.data.limit).toBe('maxWorkspaces');
      expect(body.error.data.currentUsage).toBe(1);
      expect(body.error.data.quota).toBe(1);
      expect(body.error.data.upgradeUrl).toBe('/settings/billing');
    });

    test('returns 402 when usage exceeds quota (free maxBoardsPerWorkspace = 5)', async () => {
      const res = buildLimitResponse('tier_1', 'maxBoardsPerWorkspace', 6);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(402);

      const body = await res!.json() as any;
      expect(body.error.code).toBe('limit-reached');
      expect(body.error.data.limit).toBe('maxBoardsPerWorkspace');
      expect(body.error.data.currentUsage).toBe(6);
      expect(body.error.data.quota).toBe(5);
    });

    test('returns 402 when at column cap (free maxColumnsPerBoard = 10)', () => {
      expect(buildLimitResponse('tier_1', 'maxColumnsPerBoard', 10)).not.toBeNull();
    });

    test('response body has error.code = limit-reached', async () => {
      const res = buildLimitResponse('tier_1', 'maxWorkspaces', 5);
      const body = await res!.json() as any;
      expect(body.error.code).toBe('limit-reached');
    });

    test('unlimited quota in response body when unlimited', async () => {
      // Enterprise tier maxColumnsPerBoard is unlimited — we should never reach 402 there,
      // but test that free quota is reported as number (not sentinel string) correctly.
      const res = buildLimitResponse('tier_1', 'maxWorkspaces', 2);
      const body = await res!.json() as any;
      expect(typeof body.error.data.quota).toBe('number');
    });
  });

  describe('SUBSCRIPTIONS_ENABLED bypass', () => {
    // The bypass is tested indirectly via applyLimitGuard / applyWorkspaceLimitGuard
    // which check env.SUBSCRIPTIONS_ENABLED before calling buildLimitResponse.
    // Here we verify that buildLimitResponse itself always enforces limits (it has no env dependency).
    test('buildLimitResponse always enforces limits regardless of env', () => {
      // Even at quota, buildLimitResponse always returns 402 — env bypass is the caller's responsibility.
      expect(buildLimitResponse('tier_1', 'maxWorkspaces', 1)).not.toBeNull();
    });
  });
});
