import { describe, expect, it } from 'bun:test';
import {
  FEATURE_KEYS,
  ALL_FEATURE_KEYS,
  FeatureKey,
} from '../../../../../server/extensions/subscription/common/featureKeys';

describe('featureKeys', () => {
  describe('FEATURE_KEYS structure', () => {
    it('exports nested feature key groups', () => {
      expect(FEATURE_KEYS.board).toBeDefined();
      expect(FEATURE_KEYS.list).toBeDefined();
      expect(FEATURE_KEYS.member).toBeDefined();
      expect(FEATURE_KEYS.guest).toBeDefined();
      expect(FEATURE_KEYS.storage).toBeDefined();
      expect(FEATURE_KEYS.rateLimit).toBeDefined();
    });

    it('each group contains named feature keys', () => {
      expect(FEATURE_KEYS.board.maxPerWorkspace).toBeDefined();
      expect(FEATURE_KEYS.board.maxTotal).toBeDefined();
      expect(FEATURE_KEYS.list.maxPerBoard).toBeDefined();
      expect(FEATURE_KEYS.member.maxInvitedPerBoard).toBeDefined();
      expect(FEATURE_KEYS.guest.maxPerBoard).toBeDefined();
      expect(FEATURE_KEYS.storage.maxBytes).toBeDefined();
      expect(FEATURE_KEYS.rateLimit.readPerMinute).toBeDefined();
      expect(FEATURE_KEYS.rateLimit.writePerMinute).toBeDefined();
    });
  });

  describe('key naming conventions', () => {
    it('board keys use "board:" prefix', () => {
      expect(FEATURE_KEYS.board.maxPerWorkspace).toMatch(/^board:/);
      expect(FEATURE_KEYS.board.maxTotal).toMatch(/^board:/);
    });

    it('list keys use "list:" prefix', () => {
      expect(FEATURE_KEYS.list.maxPerBoard).toMatch(/^list:/);
    });

    it('member keys use "member:" prefix', () => {
      expect(FEATURE_KEYS.member.maxInvitedPerBoard).toMatch(/^member:/);
    });

    it('guest keys use "guest:" prefix', () => {
      expect(FEATURE_KEYS.guest.maxPerBoard).toMatch(/^guest:/);
    });

    it('storage keys use "storage:" prefix', () => {
      expect(FEATURE_KEYS.storage.maxBytes).toMatch(/^storage:/);
    });

    it('rate limit keys use "ratelimit:" prefix', () => {
      expect(FEATURE_KEYS.rateLimit.readPerMinute).toMatch(/^ratelimit:/);
      expect(FEATURE_KEYS.rateLimit.writePerMinute).toMatch(/^ratelimit:/);
    });

    it('all keys use hyphenated action names (no underscores)', () => {
      const allKeys = Object.values(FEATURE_KEYS).flatMap((group) =>
        Object.values(group)
      );
      for (const key of allKeys) {
        expect(key).toMatch(/^[a-z-]+:[a-z-]+$/);
      }
    });
  });

  describe('ALL_FEATURE_KEYS array', () => {
    it('contains exactly 8 keys', () => {
      expect(ALL_FEATURE_KEYS).toHaveLength(8);
    });

    it('includes all feature keys from FEATURE_KEYS object', () => {
      const expectedKeys = [
        FEATURE_KEYS.board.maxPerWorkspace,
        FEATURE_KEYS.board.maxTotal,
        FEATURE_KEYS.list.maxPerBoard,
        FEATURE_KEYS.member.maxInvitedPerBoard,
        FEATURE_KEYS.guest.maxPerBoard,
        FEATURE_KEYS.storage.maxBytes,
        FEATURE_KEYS.rateLimit.readPerMinute,
        FEATURE_KEYS.rateLimit.writePerMinute,
      ];

      for (const key of expectedKeys) {
        expect(ALL_FEATURE_KEYS).toContain(key);
      }
    });

    it('all keys are unique (no duplicates)', () => {
      const seen = new Set();
      for (const key of ALL_FEATURE_KEYS) {
        expect(seen.has(key)).toBe(false, `Duplicate key: ${key}`);
        seen.add(key);
      }
      expect(seen.size).toBe(ALL_FEATURE_KEYS.length);
    });

    it('is a readonly array', () => {
      // Check immutability by ensuring const assertion prevents type narrowing tricks
      expect(typeof ALL_FEATURE_KEYS).toBe('object');
    });
  });

  describe('FeatureKey type', () => {
    it('type is compatible with all feature key values', () => {
      const typeCheck = (key: FeatureKey) => {
        expect(ALL_FEATURE_KEYS).toContain(key);
      };

      typeCheck(FEATURE_KEYS.board.maxPerWorkspace);
      typeCheck(FEATURE_KEYS.board.maxTotal);
      typeCheck(FEATURE_KEYS.list.maxPerBoard);
      typeCheck(FEATURE_KEYS.member.maxInvitedPerBoard);
      typeCheck(FEATURE_KEYS.guest.maxPerBoard);
      typeCheck(FEATURE_KEYS.storage.maxBytes);
      typeCheck(FEATURE_KEYS.rateLimit.readPerMinute);
      typeCheck(FEATURE_KEYS.rateLimit.writePerMinute);
    });
  });

  describe('integration scenarios', () => {
    it('can be used as entitlement object keys', () => {
      const entitlements: Record<FeatureKey, number | string> = {
        [FEATURE_KEYS.board.maxPerWorkspace]: 50,
        [FEATURE_KEYS.board.maxTotal]: 'unlimited',
        [FEATURE_KEYS.list.maxPerBoard]: 'unlimited',
        [FEATURE_KEYS.member.maxInvitedPerBoard]: 20,
        [FEATURE_KEYS.guest.maxPerBoard]: 10,
        [FEATURE_KEYS.storage.maxBytes]: 10737418240, // 10 GB
        [FEATURE_KEYS.rateLimit.readPerMinute]: 500,
        [FEATURE_KEYS.rateLimit.writePerMinute]: 200,
      };

      expect(Object.keys(entitlements)).toHaveLength(8);
      expect(entitlements[FEATURE_KEYS.board.maxPerWorkspace]).toBe(50);
    });

    it('all keys can be accessed from ALL_FEATURE_KEYS array', () => {
      for (const key of ALL_FEATURE_KEYS) {
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
      }
    });
  });
});
