// Unit tests for list creation limit enforcement.
// Tests focus on quota resolution and guard response shape for column limits.

import { describe, expect, test } from 'bun:test';
import { buildLimitResponse, resolveQuota } from '../../../../middlewares/limitGuard';

describe('list creation limit enforcement', () => {
  describe('maxColumnsPerBoard quota resolution', () => {
    test('free tier allows 10 columns per board', () => {
      expect(resolveQuota('tier_1', 'maxColumnsPerBoard')).toBe(10);
    });

    test('pro tier has unlimited columns per board', () => {
      expect(resolveQuota('tier_2', 'maxColumnsPerBoard')).toBe('unlimited');
    });

    test('enterprise tier has unlimited columns per board', () => {
      expect(resolveQuota('unlimited', 'maxColumnsPerBoard')).toBe('unlimited');
    });
  });

  describe('limit guard response — maxColumnsPerBoard', () => {
    test('allows creation when board has 0 columns (free tier)', () => {
      expect(buildLimitResponse('tier_1', 'maxColumnsPerBoard', 0)).toBeNull();
    });

    test('allows creation when board has 9 columns (free tier limit = 10)', () => {
      expect(buildLimitResponse('tier_1', 'maxColumnsPerBoard', 9)).toBeNull();
    });

    test('blocks creation when board has 10 columns on free tier (at limit)', () => {
      const res = buildLimitResponse('tier_1', 'maxColumnsPerBoard', 10);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(402);
    });

    test('blocks creation when board has more than 10 columns on free tier', () => {
      const res = buildLimitResponse('tier_1', 'maxColumnsPerBoard', 15);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(402);
    });

    test('pro tier never blocks column creation', () => {
      expect(buildLimitResponse('tier_2', 'maxColumnsPerBoard', 10_000)).toBeNull();
    });

    test('enterprise tier never blocks column creation', () => {
      expect(buildLimitResponse('unlimited', 'maxColumnsPerBoard', 10_000)).toBeNull();
    });
  });

  describe('402 response body shape', () => {
    test('blocked response has correct error envelope', async () => {
      const res = buildLimitResponse('tier_1', 'maxColumnsPerBoard', 10);
      const body = await res!.json();
      expect(body.error.code).toBe('limit-reached');
      expect(body.error.data.limit).toBe('maxColumnsPerBoard');
      expect(body.error.data.currentUsage).toBe(10);
      expect(body.error.data.quota).toBe(10);
      expect(body.error.data.upgradeUrl).toBe('/settings/billing');
    });
  });
});
