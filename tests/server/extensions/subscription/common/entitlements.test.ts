// Tests for entitlements resolver
import { describe, it, expect } from 'bun:test';
import { resolveEntitlements } from '../../../../../server/extensions/subscription/common/entitlements';
import { FEATURE_KEYS } from '../../../../../server/extensions/subscription/common/featureKeys';

describe('entitlements resolver', () => {
  it('resolves free tier from tier_1', () => {
    const entitlements = resolveEntitlements('tier_1');
    expect(entitlements[FEATURE_KEYS.board.maxPerWorkspace]).toBe(5);
    expect(entitlements[FEATURE_KEYS.member.maxInvitedPerBoard]).toBe(2);
  });

  it('resolves pro tier from tier_2', () => {
    const entitlements = resolveEntitlements('tier_2');
    expect(entitlements[FEATURE_KEYS.board.maxPerWorkspace]).toBe(50);
    expect(entitlements[FEATURE_KEYS.board.maxTotal]).toBe('unlimited');
    expect(entitlements[FEATURE_KEYS.member.maxInvitedPerBoard]).toBe(20);
  });

  it('resolves enterprise tier from unlimited', () => {
    const entitlements = resolveEntitlements('unlimited');
    expect(entitlements[FEATURE_KEYS.board.maxPerWorkspace]).toBe('unlimited');
    expect(entitlements[FEATURE_KEYS.member.maxInvitedPerBoard]).toBe('unlimited');
    expect(entitlements[FEATURE_KEYS.guest.maxPerBoard]).toBe('unlimited');
    expect(entitlements[FEATURE_KEYS.storage.maxBytes]).toBe('unlimited');
  });

  it('includes all feature keys in entitlements', () => {
    const entitlements = resolveEntitlements('tier_1');
    const keys = Object.keys(entitlements);
    
    expect(keys).toContain(FEATURE_KEYS.board.maxPerWorkspace);
    expect(keys).toContain(FEATURE_KEYS.board.maxTotal);
    expect(keys).toContain(FEATURE_KEYS.list.maxPerBoard);
    expect(keys).toContain(FEATURE_KEYS.member.maxInvitedPerBoard);
    expect(keys).toContain(FEATURE_KEYS.guest.maxPerBoard);
    expect(keys).toContain(FEATURE_KEYS.storage.maxBytes);
    expect(keys).toContain(FEATURE_KEYS.rateLimit.readPerMinute);
    expect(keys).toContain(FEATURE_KEYS.rateLimit.writePerMinute);
  });

  it('free tier has numeric quotas for most resources', () => {
    const entitlements = resolveEntitlements('tier_1');
    expect(typeof entitlements[FEATURE_KEYS.board.maxPerWorkspace]).toBe('number');
    expect(typeof entitlements[FEATURE_KEYS.member.maxInvitedPerBoard]).toBe('number');
    expect(typeof entitlements[FEATURE_KEYS.guest.maxPerBoard]).toBe('number');
  });

  it('pro tier has mixed numeric and unlimited quotas', () => {
    const entitlements = resolveEntitlements('tier_2');
    expect(entitlements[FEATURE_KEYS.board.maxTotal]).toBe('unlimited');
    expect(entitlements[FEATURE_KEYS.list.maxPerBoard]).toBe('unlimited');
  });

  it('rate limits are included for all tiers', () => {
    const free = resolveEntitlements('tier_1');
    const pro = resolveEntitlements('tier_2');
    const enterprise = resolveEntitlements('unlimited');

    expect(free[FEATURE_KEYS.rateLimit.readPerMinute]).toBe(100);
    expect(free[FEATURE_KEYS.rateLimit.writePerMinute]).toBe(30);

    expect(pro[FEATURE_KEYS.rateLimit.readPerMinute]).toBe(500);
    expect(pro[FEATURE_KEYS.rateLimit.writePerMinute]).toBe(200);

    expect(enterprise[FEATURE_KEYS.rateLimit.readPerMinute]).toBe('unlimited');
    expect(enterprise[FEATURE_KEYS.rateLimit.writePerMinute]).toBe('unlimited');
  });

  it('defaults unknown tier to free', () => {
    const entitlements = resolveEntitlements('unknown-tier' as any);
    expect(entitlements[FEATURE_KEYS.board.maxPerWorkspace]).toBe(5);
  });
});
