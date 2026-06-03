// Tests for entitlements resolver
import { describe, it, expect } from 'bun:test';
import { resolveEntitlements } from '../../../../../server/extensions/subscription/common/entitlements';
import { FEATURE_KEYS } from '../../../../../server/extensions/subscription/common/featureKeys';

describe('entitlements resolver', () => {
  it('resolves personal tier from tier_1', () => {
    const entitlements = resolveEntitlements('tier_1');
    expect(entitlements[FEATURE_KEYS.board.maxPerWorkspace]).toBe(1);
    expect(entitlements[FEATURE_KEYS.workspace.maxWorkspaces]).toBe(1);
    expect(entitlements[FEATURE_KEYS.member.maxInvitedPerBoard]).toBe('unlimited');
    expect(entitlements[FEATURE_KEYS.guest.maxPerBoard]).toBe('unlimited');
  });

  it('resolves hobby tier from tier_2', () => {
    const entitlements = resolveEntitlements('tier_2');
    expect(entitlements[FEATURE_KEYS.board.maxPerWorkspace]).toBe(10);
    expect(entitlements[FEATURE_KEYS.workspace.maxWorkspaces]).toBe(1);
    expect(entitlements[FEATURE_KEYS.card.maxPerBoard]).toBe(500);
  });

  it('resolves pro tier from tier_3', () => {
    const entitlements = resolveEntitlements('tier_3');
    expect(entitlements[FEATURE_KEYS.board.maxPerWorkspace]).toBe(30);
    expect(entitlements[FEATURE_KEYS.workspace.maxWorkspaces]).toBe(5);
    expect(entitlements[FEATURE_KEYS.card.maxPerBoard]).toBe(1000);
  });

  it('resolves business tier from tier_4', () => {
    const entitlements = resolveEntitlements('tier_4');
    expect(entitlements[FEATURE_KEYS.board.maxPerWorkspace]).toBe(200);
    expect(entitlements[FEATURE_KEYS.workspace.maxWorkspaces]).toBe(50);
    expect(entitlements[FEATURE_KEYS.card.maxPerBoard]).toBe(5000);
  });

  it('resolves enterprise tier from unlimited', () => {
    const entitlements = resolveEntitlements('unlimited');
    expect(entitlements[FEATURE_KEYS.board.maxPerWorkspace]).toBe('unlimited');
    expect(entitlements[FEATURE_KEYS.workspace.maxWorkspaces]).toBe('unlimited');
    expect(entitlements[FEATURE_KEYS.member.maxInvitedPerBoard]).toBe('unlimited');
    expect(entitlements[FEATURE_KEYS.guest.maxPerBoard]).toBe('unlimited');
    expect(entitlements[FEATURE_KEYS.storage.maxBytes]).toBe('unlimited');
  });

  it('includes all feature keys in entitlements', () => {
    const entitlements = resolveEntitlements('tier_1');
    const keys = Object.keys(entitlements);

    expect(keys).toContain(FEATURE_KEYS.workspace.maxWorkspaces);
    expect(keys).toContain(FEATURE_KEYS.board.maxPerWorkspace);
    expect(keys).toContain(FEATURE_KEYS.board.maxTotal);
    expect(keys).toContain(FEATURE_KEYS.list.maxPerBoard);
    expect(keys).toContain(FEATURE_KEYS.card.maxPerBoard);
    expect(keys).toContain(FEATURE_KEYS.member.maxInvitedPerBoard);
    expect(keys).toContain(FEATURE_KEYS.guest.maxPerBoard);
    expect(keys).toContain(FEATURE_KEYS.storage.maxBytes);
    expect(keys).toContain(FEATURE_KEYS.rateLimit.readPerMinute);
    expect(keys).toContain(FEATURE_KEYS.rateLimit.writePerMinute);
  });

  it('personal tier has numeric quotas for most resources', () => {
    const entitlements = resolveEntitlements('tier_1');
    expect(typeof entitlements[FEATURE_KEYS.board.maxPerWorkspace]).toBe('number');
    expect(typeof entitlements[FEATURE_KEYS.workspace.maxWorkspaces]).toBe('number');
    expect(typeof entitlements[FEATURE_KEYS.card.maxPerBoard]).toBe('number');
  });

  it('rate limits are included for all tiers', () => {
    const personal = resolveEntitlements('tier_1');
    const hobby = resolveEntitlements('tier_2');
    const business = resolveEntitlements('tier_4');
    const enterprise = resolveEntitlements('unlimited');

    expect(personal[FEATURE_KEYS.rateLimit.readPerMinute]).toBe(500);
    expect(personal[FEATURE_KEYS.rateLimit.writePerMinute]).toBe(200);

    expect(hobby[FEATURE_KEYS.rateLimit.readPerMinute]).toBe(500);
    expect(hobby[FEATURE_KEYS.rateLimit.writePerMinute]).toBe(200);

    expect(business[FEATURE_KEYS.rateLimit.readPerMinute]).toBe(3000);
    expect(business[FEATURE_KEYS.rateLimit.writePerMinute]).toBe(1000);

    expect(enterprise[FEATURE_KEYS.rateLimit.readPerMinute]).toBe('unlimited');
    expect(enterprise[FEATURE_KEYS.rateLimit.writePerMinute]).toBe('unlimited');
  });

  it('defaults unknown tier to personal', () => {
    const entitlements = resolveEntitlements('unknown-tier' as any);
    expect(entitlements[FEATURE_KEYS.board.maxPerWorkspace]).toBe(1);
  });
});
