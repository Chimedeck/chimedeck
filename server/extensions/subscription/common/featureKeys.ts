// Canonical feature/limit keys for entitlements, gating, and enforcement.
// Single source of truth for all feature names referenced in tier quotas, gates, and guards.

// Workspace limits
export const FEATURE_KEYS = {
  workspace: {
    maxWorkspaces: 'workspace:max-workspaces',
  },

  // Board limits
  board: {
    maxPerWorkspace: 'board:max-per-workspace',
    maxTotal: 'board:max-total',
  },

  // List/Column limits
  list: {
    maxPerBoard: 'list:max-per-board',
  },

  // Member limits
  member: {
    maxInvitedPerBoard: 'member:max-invited-per-board',
  },

  // Guest limits
  guest: {
    maxPerBoard: 'guest:max-per-board',
  },

  // Storage limits
  storage: {
    maxBytes: 'storage:max-bytes',
  },

  // Rate limiting
  rateLimit: {
    readPerMinute: 'ratelimit:read-per-minute',
    writePerMinute: 'ratelimit:write-per-minute',
  },
} as const;

// Flat list of all feature keys for validation
export const ALL_FEATURE_KEYS = [
  FEATURE_KEYS.workspace.maxWorkspaces,
  FEATURE_KEYS.board.maxPerWorkspace,
  FEATURE_KEYS.board.maxTotal,
  FEATURE_KEYS.list.maxPerBoard,
  FEATURE_KEYS.member.maxInvitedPerBoard,
  FEATURE_KEYS.guest.maxPerBoard,
  FEATURE_KEYS.storage.maxBytes,
  FEATURE_KEYS.rateLimit.readPerMinute,
  FEATURE_KEYS.rateLimit.writePerMinute,
] as const;

// Type for feature keys (used in entitlements objects)
export type FeatureKey = typeof ALL_FEATURE_KEYS[number];
