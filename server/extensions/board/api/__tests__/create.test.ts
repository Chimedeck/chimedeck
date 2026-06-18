// Unit tests for board creation limit enforcement.
// Tests focus on quota resolution and guard response shape for board limits.

import { describe, expect, test } from 'bun:test';
import { buildLimitResponse, resolveQuota } from '../../../../middlewares/limitGuard';

describe('board creation limit enforcement', () => {
  describe('maxBoardsPerWorkspace quota resolution', () => {
    test('free tier allows 5 boards per workspace', () => {
      expect(resolveQuota('tier_1', 'maxBoardsPerWorkspace')).toBe(5);
    });

    test('pro tier allows 50 boards per workspace', () => {
      expect(resolveQuota('tier_2', 'maxBoardsPerWorkspace')).toBe(50);
    });

    test('enterprise tier has unlimited boards per workspace', () => {
      expect(resolveQuota('unlimited', 'maxBoardsPerWorkspace')).toBe('unlimited');
    });
  });

  describe('maxBoardsTotal quota resolution', () => {
    test('free tier total board cap is 5', () => {
      expect(resolveQuota('tier_1', 'maxBoardsTotal')).toBe(5);
    });

    test('pro tier total board cap is unlimited', () => {
      expect(resolveQuota('tier_2', 'maxBoardsTotal')).toBe('unlimited');
    });

    test('enterprise tier total board cap is unlimited', () => {
      expect(resolveQuota('unlimited', 'maxBoardsTotal')).toBe('unlimited');
    });
  });

  describe('limit guard response — maxBoardsPerWorkspace', () => {
    test('allows creation when workspace has 0 boards (free tier)', () => {
      expect(buildLimitResponse('tier_1', 'maxBoardsPerWorkspace', 0)).toBeNull();
    });

    test('allows creation when workspace has 4 boards (free tier limit = 5)', () => {
      expect(buildLimitResponse('tier_1', 'maxBoardsPerWorkspace', 4)).toBeNull();
    });

    test('blocks creation when workspace has 5 boards on free tier (at limit)', () => {
      const res = buildLimitResponse('tier_1', 'maxBoardsPerWorkspace', 5);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(402);
    });

    test('blocks creation when workspace has 50 boards on pro tier (at limit)', () => {
      const res = buildLimitResponse('tier_2', 'maxBoardsPerWorkspace', 50);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(402);
    });

    test('enterprise tier never blocks board creation', () => {
      expect(buildLimitResponse('unlimited', 'maxBoardsPerWorkspace', 10_000)).toBeNull();
    });
  });

  describe('limit guard response — maxBoardsTotal', () => {
    test('allows creation when total board count is below free tier limit', () => {
      expect(buildLimitResponse('tier_1', 'maxBoardsTotal', 4)).toBeNull();
    });

    test('blocks creation when total board count is at free tier limit', () => {
      const res = buildLimitResponse('tier_1', 'maxBoardsTotal', 5);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(402);
    });

    test('pro tier total is unlimited — never blocks', () => {
      expect(buildLimitResponse('tier_2', 'maxBoardsTotal', 10_000)).toBeNull();
    });
  });

  describe('402 response body shape', () => {
    test('blocked response has correct error envelope', async () => {
      const res = buildLimitResponse('tier_1', 'maxBoardsPerWorkspace', 5);
      const body = await res!.json();
      expect(body.error.code).toBe('limit-reached');
      expect(body.error.data.limit).toBe('maxBoardsPerWorkspace');
      expect(body.error.data.currentUsage).toBe(5);
      expect(body.error.data.quota).toBe(5);
      expect(body.error.data.upgradeUrl).toBe('/settings/billing');
    });
  });
});
