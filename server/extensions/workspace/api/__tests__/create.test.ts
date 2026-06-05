// Unit tests for workspace creation limit enforcement.
// Tests focus on the guard module's pure functions with the SUBSCRIPTIONS_ENABLED bypass path.
// DB-dependent integration paths are covered by limitGuard.test.ts + resolveQuota tests.

import { describe, expect, test } from 'bun:test';
import { buildLimitResponse, resolveQuota } from '../../../../middlewares/limitGuard';

describe('workspace creation limit enforcement', () => {
  describe('board quota resolution', () => {
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

  describe('limit guard response — maxBoardsPerWorkspace', () => {
    test('blocks creation when workspace already has 5 boards on free tier', () => {
      const res = buildLimitResponse('tier_1', 'maxBoardsPerWorkspace', 5, 'ws_1');
      expect(res).not.toBeNull();
      expect(res!.status).toBe(402);
    });

    test('allows creation when workspace has 4 boards on free tier', () => {
      expect(buildLimitResponse('tier_1', 'maxBoardsPerWorkspace', 4, 'ws_1')).toBeNull();
    });

    test('allows creation when workspace has 49 boards on pro tier (limit = 50)', () => {
      expect(buildLimitResponse('tier_2', 'maxBoardsPerWorkspace', 49, 'ws_1')).toBeNull();
    });

    test('blocks creation when workspace has 50 boards on pro tier (at limit)', () => {
      const res = buildLimitResponse('tier_2', 'maxBoardsPerWorkspace', 50, 'ws_1');
      expect(res).not.toBeNull();
      expect(res!.status).toBe(402);
    });

    test('enterprise tier never blocks regardless of board count', () => {
      expect(buildLimitResponse('unlimited', 'maxBoardsPerWorkspace', 10_000, 'ws_1')).toBeNull();
    });
  });

  describe('402 response body shape', () => {
    test('blocked response has correct error envelope', async () => {
      const res = buildLimitResponse('tier_1', 'maxBoardsPerWorkspace', 5, 'ws_1');
      const body = await res!.json() as any;
      expect(body.error.code).toBe('limit-reached');
      expect(body.error.data.limit).toBe('maxBoardsPerWorkspace');
      expect(body.error.data.currentUsage).toBe(5);
      expect(body.error.data.quota).toBe(5);
      expect(body.error.data.upgradeUrl).toBe('/workspace/ws_1/billing');
    });
  });
});
