import { describe, expect, test } from 'bun:test';
import { matchGate, minimumTierFor } from './featureGate';
import { FEATURE_GATES } from '../config/feature-gates';
import { SUBSCRIPTION_TIERS, TIER_ORDER } from '../config/subscription-tiers';
import type { BooleanFeatureKey } from '../config/subscription-tiers';

// ---------------------------------------------------------------------------
// matchGate — path + method matching
// ---------------------------------------------------------------------------

describe('matchGate', () => {
  test('returns null for an ungated route', () => {
    const result = matchGate('GET', '/api/v1/boards', FEATURE_GATES);
    expect(result).toBeNull();
  });

  test('returns null for /health', () => {
    const result = matchGate('GET', '/health', FEATURE_GATES);
    expect(result).toBeNull();
  });

  test('matches automation CRUD on a board (POST)', () => {
    const rule = matchGate('POST', '/api/v1/boards/abc123/automations', FEATURE_GATES);
    expect(rule).not.toBeNull();
    expect(rule!.feature).toBe('automations');
  });

  test('matches automation CRUD on a board (GET with automation ID)', () => {
    const rule = matchGate('GET', '/api/v1/boards/abc123/automations/def456', FEATURE_GATES);
    expect(rule).not.toBeNull();
    expect(rule!.feature).toBe('automations');
  });

  test('matches board automation-runs route', () => {
    const rule = matchGate('GET', '/api/v1/boards/abc123/automation-runs', FEATURE_GATES);
    expect(rule).not.toBeNull();
    expect(rule!.feature).toBe('automations');
  });

  test('matches card automation-buttons route', () => {
    const rule = matchGate('POST', '/api/v1/cards/card1/automation-buttons/auto1/run', FEATURE_GATES);
    expect(rule).not.toBeNull();
    expect(rule!.feature).toBe('automations');
  });

  test('matches GET automation discovery endpoint', () => {
    const rule = matchGate('GET', '/api/v1/automation/trigger-types', FEATURE_GATES);
    expect(rule).not.toBeNull();
    expect(rule!.feature).toBe('automations');
  });

  test('does NOT match POST to automation discovery endpoint (GET-only rule)', () => {
    // Only GET methods are gated for discovery; POST doesn't exist there but should not match.
    const rule = matchGate('POST', '/api/v1/automation/trigger-types', FEATURE_GATES);
    // There's no wildcard rule for /api/v1/automation/ matching POST
    expect(rule?.feature).not.toBe('automations' as BooleanFeatureKey);
  });

  test('matches webhooks (GET)', () => {
    const rule = matchGate('GET', '/api/v1/webhooks', FEATURE_GATES);
    expect(rule).not.toBeNull();
    expect(rule!.feature).toBe('webhooks');
  });

  test('matches webhooks (POST)', () => {
    const rule = matchGate('POST', '/api/v1/webhooks', FEATURE_GATES);
    expect(rule).not.toBeNull();
    expect(rule!.feature).toBe('webhooks');
  });

  test('matches plugins on a board', () => {
    const rule = matchGate('POST', '/api/v1/boards/board1/plugins', FEATURE_GATES);
    expect(rule).not.toBeNull();
    expect(rule!.feature).toBe('plugins');
  });

  test('matches custom-fields on a board', () => {
    const rule = matchGate('POST', '/api/v1/boards/board1/custom-fields', FEATURE_GATES);
    expect(rule).not.toBeNull();
    expect(rule!.feature).toBe('customFields');
  });

  test('matches custom-field-values on a card', () => {
    const rule = matchGate('PUT', '/api/v1/cards/card1/custom-field-values/field1', FEATURE_GATES);
    expect(rule).not.toBeNull();
    expect(rule!.feature).toBe('customFields');
  });

  test('matches API tokens', () => {
    const rule = matchGate('POST', '/api/v1/tokens', FEATURE_GATES);
    expect(rule).not.toBeNull();
    expect(rule!.feature).toBe('apiTokens');
  });

  test('matches state-transitions on a board', () => {
    const rule = matchGate('GET', '/api/v1/boards/board1/state-transitions', FEATURE_GATES);
    expect(rule).not.toBeNull();
    expect(rule!.feature).toBe('stateTransitions');
  });

  test('does not match boards listing (ungated)', () => {
    expect(matchGate('GET', '/api/v1/boards', FEATURE_GATES)).toBeNull();
    expect(matchGate('GET', '/api/v1/boards/board1', FEATURE_GATES)).toBeNull();
    expect(matchGate('GET', '/api/v1/boards/board1/lists', FEATURE_GATES)).toBeNull();
    expect(matchGate('GET', '/api/v1/boards/board1/cards', FEATURE_GATES)).toBeNull();
  });

  test('does not match workspaces routes (ungated)', () => {
    expect(matchGate('GET', '/api/v1/workspaces', FEATURE_GATES)).toBeNull();
    expect(matchGate('POST', '/api/v1/workspaces', FEATURE_GATES)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// minimumTierFor — cheapest tier that enables each feature
// ---------------------------------------------------------------------------

describe('minimumTierFor', () => {
  test('automations requires tier_2 (pro)', () => {
    expect(minimumTierFor('automations')).toBe('tier_2');
  });

  test('webhooks requires unlimited (enterprise)', () => {
    expect(minimumTierFor('webhooks')).toBe('unlimited');
  });

  test('plugins requires tier_2 (pro)', () => {
    expect(minimumTierFor('plugins')).toBe('tier_2');
  });

  test('customFields requires tier_2 (pro)', () => {
    expect(minimumTierFor('customFields')).toBe('tier_2');
  });

  test('apiTokens requires tier_2 (pro)', () => {
    expect(minimumTierFor('apiTokens')).toBe('tier_2');
  });

  test('stateTransitions requires tier_2 (pro)', () => {
    expect(minimumTierFor('stateTransitions')).toBe('tier_2');
  });

  test('result is always a valid TIER_ORDER member', () => {
    const features: BooleanFeatureKey[] = [
      'automations', 'webhooks', 'plugins', 'customFields', 'apiTokens', 'stateTransitions',
    ];
    for (const f of features) {
      expect(TIER_ORDER).toContain(minimumTierFor(f));
    }
  });
});

// ---------------------------------------------------------------------------
// SUBSCRIPTION_TIERS boolean features — sanity checks
// ---------------------------------------------------------------------------

describe('SUBSCRIPTION_TIERS feature flags', () => {
  test('free tier has all features disabled', () => {
    const { features } = SUBSCRIPTION_TIERS.free;
    expect(features.automations).toBe(false);
    expect(features.webhooks).toBe(false);
    expect(features.plugins).toBe(false);
    expect(features.customFields).toBe(false);
    expect(features.apiTokens).toBe(false);
    expect(features.stateTransitions).toBe(false);
  });

  test('pro tier enables automations but not webhooks', () => {
    const { features } = SUBSCRIPTION_TIERS.pro;
    expect(features.automations).toBe(true);
    expect(features.webhooks).toBe(false);
  });

  test('enterprise tier enables all features', () => {
    const { features } = SUBSCRIPTION_TIERS.enterprise;
    expect(features.automations).toBe(true);
    expect(features.webhooks).toBe(true);
    expect(features.plugins).toBe(true);
    expect(features.customFields).toBe(true);
    expect(features.apiTokens).toBe(true);
    expect(features.stateTransitions).toBe(true);
  });
});
