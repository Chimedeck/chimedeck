// Declarative endpoint-to-feature gate map.
// Single source of truth for which API routes require a paid feature.
// Anything not listed here is ungated and available on every tier.
//
// Path matching uses prefix matching with segment-aware wildcards:
//   ':param' matches exactly one non-slash path segment.
// Rules are evaluated in order; the first match wins.

import type { BooleanFeatureKey } from './subscription-tiers';

export interface GateRule {
  /** HTTP method(s) this rule applies to. '*' matches all methods. */
  methods: ('GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | '*')[];
  /** Path prefix matched against the request pathname. ':param' matches one segment. */
  pathPrefix: string;
  /** Feature that must be enabled in the workspace's tier entitlements. */
  feature: BooleanFeatureKey;
}

export const FEATURE_GATES: GateRule[] = [
  // Automations — board-scoped CRUD and discovery endpoints
  { methods: ['*'], pathPrefix: '/api/v1/boards/:boardId/automations', feature: 'automations' },
  { methods: ['*'], pathPrefix: '/api/v1/boards/:boardId/automation-', feature: 'automations' },
  { methods: ['*'], pathPrefix: '/api/v1/cards/:cardId/automation-', feature: 'automations' },
  { methods: ['GET'], pathPrefix: '/api/v1/automation/', feature: 'automations' },

  // Webhooks — global registration endpoints
  { methods: ['*'], pathPrefix: '/api/v1/webhooks', feature: 'webhooks' },

  // Plugins — board-scoped plugin management
  { methods: ['*'], pathPrefix: '/api/v1/boards/:boardId/plugins', feature: 'plugins' },
  { methods: ['*'], pathPrefix: '/api/v1/plugins/data', feature: 'plugins' },

  // Custom fields — board-scoped definitions + card-scoped values
  { methods: ['*'], pathPrefix: '/api/v1/boards/:boardId/custom-fields', feature: 'customFields' },
  { methods: ['*'], pathPrefix: '/api/v1/boards/:boardId/custom-field-', feature: 'customFields' },
  { methods: ['*'], pathPrefix: '/api/v1/cards/:cardId/custom-field-', feature: 'customFields' },

  // API tokens — user-scoped token management
  { methods: ['*'], pathPrefix: '/api/v1/tokens', feature: 'apiTokens' },

  // State transitions — board-scoped workflow definitions
  { methods: ['*'], pathPrefix: '/api/v1/boards/:boardId/state-transitions', feature: 'stateTransitions' },
];
