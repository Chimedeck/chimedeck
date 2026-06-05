import { describe, expect, it } from 'bun:test';
import {
  SUBSCRIPTION_TIERS,
  DEFAULT_UNLIMITED_TIER,
  TierQuotas,
} from '../../../server/config/subscription-tiers';

describe('subscription-tiers config', () => {
  const REQUIRED_TIERS = ['personal', 'hobby', 'pro', 'business', 'enterprise'];
  const REQUIRED_QUOTA_KEYS: (keyof TierQuotas)[] = [
    'maxWorkspaces',
    'maxBoardsPerWorkspace',
    'maxBoardsTotal',
    'maxColumnsPerBoard',
    'maxCardsPerBoard',
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

  it('personal tier has numeric quotas for all capacity fields', () => {
    const personalTier = SUBSCRIPTION_TIERS.personal;
    // members and guests are unlimited even on personal; capacity fields are numeric
    const numericFields: (keyof TierQuotas)[] = [
      'maxWorkspaces', 'maxBoardsPerWorkspace', 'maxBoardsTotal',
      'maxColumnsPerBoard', 'maxCardsPerBoard', 'maxStorageBytes',
      'readRateLimit', 'writeRateLimit',
    ];
    for (const key of numericFields) {
      expect(typeof personalTier[key]).toBe(
        'number',
        `personal tier.${key} should be numeric, got ${personalTier[key]}`
      );
    }
  });

  it('hobby tier has numeric quotas for all capacity fields', () => {
    const hobbyTier = SUBSCRIPTION_TIERS.hobby;
    const numericFields: (keyof TierQuotas)[] = [
      'maxWorkspaces', 'maxBoardsPerWorkspace', 'maxBoardsTotal',
      'maxColumnsPerBoard', 'maxCardsPerBoard', 'maxStorageBytes',
      'readRateLimit', 'writeRateLimit',
    ];
    for (const key of numericFields) {
      expect(typeof hobbyTier[key]).toBe(
        'number',
        `hobby tier.${key} should be numeric, got ${hobbyTier[key]}`
      );
    }
  });

  it('pro tier has mostly numeric quotas with some unlimited', () => {
    const proTier = SUBSCRIPTION_TIERS.pro;
    expect(typeof proTier.maxWorkspaces).toBe('number');
    expect(typeof proTier.maxBoardsPerWorkspace).toBe('number');
    expect(typeof proTier.maxCardsPerBoard).toBe('number');
  });

  it('business tier has some unlimited quotas', () => {
    const businessTier = SUBSCRIPTION_TIERS.business;
    expect(businessTier.maxBoardsTotal).toBe('unlimited');
    expect(typeof businessTier.maxWorkspaces).toBe('number');
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

  it('tiers are strictly ordered by workspace count (personal <= hobby <= pro <= business)', () => {
    const personal = SUBSCRIPTION_TIERS.personal;
    const hobby = SUBSCRIPTION_TIERS.hobby;
    const pro = SUBSCRIPTION_TIERS.pro;
    const business = SUBSCRIPTION_TIERS.business;

    expect((hobby.maxBoardsPerWorkspace as number) >= (personal.maxBoardsPerWorkspace as number)).toBe(true);
    expect((pro.maxWorkspaces as number) > (hobby.maxWorkspaces as number)).toBe(true);
    expect((business.maxWorkspaces as number) > (pro.maxWorkspaces as number)).toBe(true);
  });

  it('stateTransitions is false for personal, true for paid tiers', () => {
    expect(SUBSCRIPTION_TIERS.personal.features.stateTransitions).toBe(false);
    expect(SUBSCRIPTION_TIERS.hobby.features.stateTransitions).toBe(true);
    expect(SUBSCRIPTION_TIERS.pro.features.stateTransitions).toBe(true);
    expect(SUBSCRIPTION_TIERS.business.features.stateTransitions).toBe(true);
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
