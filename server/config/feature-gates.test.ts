import { describe, expect, test } from 'bun:test';
import { FEATURE_GATES, type GateRule } from './feature-gates';
import type { BooleanFeatureKey } from './subscription-tiers';

describe('FEATURE_GATES map', () => {
  test('every rule has at least one method', () => {
    for (const rule of FEATURE_GATES) {
      expect(rule.methods.length).toBeGreaterThan(0);
    }
  });

  test('every rule has a non-empty pathPrefix starting with /api/v1/', () => {
    for (const rule of FEATURE_GATES) {
      expect(rule.pathPrefix.startsWith('/api/v1/')).toBe(true);
    }
  });

  test('every rule references a known feature key', () => {
    const knownFeatures: BooleanFeatureKey[] = [
      'automations',
      'webhooks',
      'plugins',
      'customFields',
      'apiTokens',
      'stateTransitions',
    ];
    for (const rule of FEATURE_GATES) {
      expect(knownFeatures).toContain(rule.feature);
    }
  });

  test('automations gate covers board-scoped automation routes', () => {
    const automationRules = FEATURE_GATES.filter((r) => r.feature === 'automations');
    const prefixes = automationRules.map((r) => r.pathPrefix);
    expect(prefixes.some((p) => p.includes('boards') && p.includes('automations'))).toBe(true);
  });

  test('webhooks gate covers /api/v1/webhooks', () => {
    const webhookRule = FEATURE_GATES.find((r) => r.feature === 'webhooks');
    expect(webhookRule).toBeDefined();
    expect(webhookRule!.pathPrefix).toBe('/api/v1/webhooks');
  });

  test('stateTransitions gate covers board-scoped state-transitions routes', () => {
    const stRule = FEATURE_GATES.find(
      (r) => r.feature === 'stateTransitions' && r.pathPrefix.includes('state-transitions')
    );
    expect(stRule).toBeDefined();
  });
});

describe('GateRule structure', () => {
  test('wildcard method rule is represented as *', () => {
    const wildcardRules = FEATURE_GATES.filter((r) => r.methods.includes('*'));
    expect(wildcardRules.length).toBeGreaterThan(0);
  });

  test('GET-only rules are defined for discovery endpoints', () => {
    const getOnlyRules = FEATURE_GATES.filter(
      (r) => r.methods.length === 1 && r.methods[0] === 'GET'
    );
    expect(getOnlyRules.length).toBeGreaterThan(0);
  });
});
