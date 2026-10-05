import { describe, expect, test } from 'bun:test';
import { findBlockingFreeOwnedWorkspace } from '../create';

describe('workspace creation subscription ownership policy', () => {
  test('allows creation when user owns no workspaces', () => {
    expect(findBlockingFreeOwnedWorkspace([])).toBeNull();
  });

  test('blocks creation when user owns a free workspace (tier_1)', () => {
    expect(findBlockingFreeOwnedWorkspace([{ workspaceId: 'ws-free', tier: 'tier_1' }])).toBe(
      'ws-free'
    );
  });

  test('treats missing subscription row as free and blocks', () => {
    expect(findBlockingFreeOwnedWorkspace([{ workspaceId: 'ws-no-sub', tier: null }])).toBe(
      'ws-no-sub'
    );
  });

  test('allows creation when all owned workspaces are paid tiers', () => {
    expect(
      findBlockingFreeOwnedWorkspace([
        { workspaceId: 'ws-pro', tier: 'tier_2' },
        { workspaceId: 'ws-ent', tier: 'unlimited' },
      ])
    ).toBeNull();
  });

  test('blocks if any owned workspace is free, even with paid workspaces present', () => {
    expect(
      findBlockingFreeOwnedWorkspace([
        { workspaceId: 'ws-pro', tier: 'tier_2' },
        { workspaceId: 'ws-free', tier: 'tier_1' },
      ])
    ).toBe('ws-free');
  });
});
