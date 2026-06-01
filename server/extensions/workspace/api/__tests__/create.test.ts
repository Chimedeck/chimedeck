// Unit tests for workspace creation limit enforcement.
// Tests focus on the guard module's pure functions with the SUBSCRIPTIONS_ENABLED bypass path.
// DB-dependent integration paths are covered by limitGuard.test.ts + resolveQuota tests.

import { describe, expect, test } from 'bun:test';
import { buildLimitResponse, resolveQuota } from '../../../../middlewares/limitGuard';

describe('workspace creation limit enforcement', () => {
  describe('maxWorkspaces quota resolution', () => {
    test('free tier allows 1 workspace', () => {
      expect(resolveQuota('tier_1', 'maxWorkspaces')).toBe(1);
    });

    test('pro tier allows 5 workspaces', () => {
      expect(resolveQuota('tier_2', 'maxWorkspaces')).toBe(5);
    });

    test('enterprise tier has unlimited workspaces', () => {
      expect(resolveQuota('unlimited', 'maxWorkspaces')).toBe('unlimited');
    });
  });

  describe('limit guard response — maxWorkspaces', () => {
    test('blocks creation when user already has 1 workspace on free tier', () => {
      const res = buildLimitResponse('tier_1', 'maxWorkspaces', 1);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(402);
    });

    test('allows creation when user has 0 workspaces on free tier', () => {
      expect(buildLimitResponse('tier_1', 'maxWorkspaces', 0)).toBeNull();
    });

    test('allows creation when user has 4 workspaces on pro tier (limit = 5)', () => {
      expect(buildLimitResponse('tier_2', 'maxWorkspaces', 4)).toBeNull();
    });

    test('blocks creation when user has 5 workspaces on pro tier (at limit)', () => {
      const res = buildLimitResponse('tier_2', 'maxWorkspaces', 5);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(402);
    });

    test('enterprise tier never blocks regardless of count', () => {
      expect(buildLimitResponse('unlimited', 'maxWorkspaces', 10_000)).toBeNull();
    });
  });

  describe('402 response body shape', () => {
    test('blocked response has correct error envelope', async () => {
      const res = buildLimitResponse('tier_1', 'maxWorkspaces', 1);
      const body = await res!.json() as any;
      expect(body.error.code).toBe('limit-reached');
      expect(body.error.data.limit).toBe('maxWorkspaces');
      expect(body.error.data.currentUsage).toBe(1);
      expect(body.error.data.quota).toBe(1);
      expect(body.error.data.upgradeUrl).toBe('/settings/billing');
    });
  });
});
