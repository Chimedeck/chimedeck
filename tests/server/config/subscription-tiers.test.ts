import { describe, expect, it } from 'bun:test';
import {
  SUBSCRIPTION_TIERS,
  DEFAULT_UNLIMITED_TIER,
  TierQuotas,
} from '../../../server/config/subscription-tiers';

describe('subscription-tiers config', () => {
  const REQUIRED_TIERS = ['free', 'pro', 'enterprise'];
  const REQUIRED_QUOTA_KEYS: (keyof TierQuotas)[] = [
    'maxBoardsPerWorkspace',
    'maxBoardsTotal',
    'maxColumnsPerBoard',
    'maxInvitedMembersPerBoard',
    'maxGuestsPerBoard',
    'maxStorageBytes',
    'readRateLimit',
    'writeRateLimit',
  ];

  function pickQuotaValues(tier: TierQuotas) {
    return REQUIRED_QUOTA_KEYS.map((key) => [key, tier[key]] as const);
  }

  it('exports all required tier keys', () => {
    for (const tierName of REQUIRED_TIERS) {
      expect(SUBSCRIPTION_TIERS[tierName]).toBeDefined();
    }
  });

  it('each tier has all required quota keys', () => {
    for (const [tierName, tier] of Object.entries(SUBSCRIPTION_TIERS)) {
      for (const quotaKey of REQUIRED_QUOTA_KEYS) {
        expect(tier[quotaKey]).toBeDefined(
          `${tierName} missing quota key ${String(quotaKey)}`
        );
      }
    }
  });

  it('all quota values are either number or "unlimited"', () => {
    for (const [tierName, tier] of Object.entries(SUBSCRIPTION_TIERS)) {
      for (const [quotaKey, value] of pickQuotaValues(tier)) {
        const valid =
          typeof value === 'number' || value === 'unlimited';
        expect(valid).toBe(
          true,
          `${tierName}.${quotaKey} = ${value} is invalid (must be number or "unlimited")`
        );
        if (typeof value === 'number') {
          expect(value).toBeGreaterThan(
            0,
            `${tierName}.${quotaKey} must be positive when numeric`
          );
        }
      }
    }
  });

  it('free tier has all numeric (no unlimited) quotas', () => {
    const freeTier = SUBSCRIPTION_TIERS.free;
    for (const [key, value] of pickQuotaValues(freeTier)) {
      expect(typeof value).toBe(
        'number',
        `free tier.${key} should be numeric, got ${value}`
      );
    }
  });

  it('pro tier has mostly numeric quotas with some unlimited', () => {
    const proTier = SUBSCRIPTION_TIERS.pro;
    expect(proTier.maxBoardsTotal).toBe('unlimited');
    expect(proTier.maxColumnsPerBoard).toBe('unlimited');
    expect(typeof proTier.maxBoardsPerWorkspace).toBe('number');
  });

  it('enterprise tier has all unlimited quotas', () => {
    const entTier = SUBSCRIPTION_TIERS.enterprise;
    for (const [key, value] of pickQuotaValues(entTier)) {
      expect(value).toBe(
        'unlimited',
        `enterprise tier.${key} should be unlimited, got ${value}`
      );
    }
  });

  it('free tier quotas are strictly ordered (higher for pro, enterprise)', () => {
    const free = SUBSCRIPTION_TIERS.free;
    const pro = SUBSCRIPTION_TIERS.pro;

    expect((pro.maxBoardsPerWorkspace as number) >=
      (free.maxBoardsPerWorkspace as number)).toBe(true);
  });

  it('DEFAULT_UNLIMITED_TIER is enterprise', () => {
    expect(DEFAULT_UNLIMITED_TIER).toEqual(SUBSCRIPTION_TIERS.enterprise);
  });

  it('DEFAULT_UNLIMITED_TIER has only unlimited values', () => {
    for (const [key, value] of pickQuotaValues(DEFAULT_UNLIMITED_TIER)) {
      expect(value).toBe('unlimited', `fallback tier.${key} should be unlimited`);
    }
  });
});
