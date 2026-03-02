import { describe, expect, test } from 'bun:test';
import { roleRank, hasRole, requireRole } from './permissionManager';
import type { WorkspaceScopedRequest } from './permissionManager';

describe('roleRank', () => {
  test('OWNER has highest rank', () => {
    expect(roleRank('OWNER')).toBeGreaterThan(roleRank('ADMIN'));
  });

  test('ADMIN > MEMBER > VIEWER', () => {
    expect(roleRank('ADMIN')).toBeGreaterThan(roleRank('MEMBER'));
    expect(roleRank('MEMBER')).toBeGreaterThan(roleRank('VIEWER'));
  });

  test('full hierarchy OWNER > ADMIN > MEMBER > VIEWER', () => {
    expect(roleRank('OWNER') > roleRank('ADMIN')).toBe(true);
    expect(roleRank('ADMIN') > roleRank('MEMBER')).toBe(true);
    expect(roleRank('MEMBER') > roleRank('VIEWER')).toBe(true);
  });
});

describe('hasRole', () => {
  test('OWNER satisfies any minimum role', () => {
    expect(hasRole('OWNER', 'OWNER')).toBe(true);
    expect(hasRole('OWNER', 'ADMIN')).toBe(true);
    expect(hasRole('OWNER', 'MEMBER')).toBe(true);
    expect(hasRole('OWNER', 'VIEWER')).toBe(true);
  });

  test('VIEWER only satisfies VIEWER', () => {
    expect(hasRole('VIEWER', 'VIEWER')).toBe(true);
    expect(hasRole('VIEWER', 'MEMBER')).toBe(false);
    expect(hasRole('VIEWER', 'ADMIN')).toBe(false);
    expect(hasRole('VIEWER', 'OWNER')).toBe(false);
  });

  test('ADMIN satisfies ADMIN, MEMBER, VIEWER but not OWNER', () => {
    expect(hasRole('ADMIN', 'OWNER')).toBe(false);
    expect(hasRole('ADMIN', 'ADMIN')).toBe(true);
    expect(hasRole('ADMIN', 'MEMBER')).toBe(true);
    expect(hasRole('ADMIN', 'VIEWER')).toBe(true);
  });

  test('MEMBER satisfies MEMBER and VIEWER but not ADMIN or OWNER', () => {
    expect(hasRole('MEMBER', 'OWNER')).toBe(false);
    expect(hasRole('MEMBER', 'ADMIN')).toBe(false);
    expect(hasRole('MEMBER', 'MEMBER')).toBe(true);
    expect(hasRole('MEMBER', 'VIEWER')).toBe(true);
  });
});

describe('requireRole', () => {
  function makeReq(callerRole?: string): WorkspaceScopedRequest {
    return { callerRole } as WorkspaceScopedRequest;
  }

  test('returns null when caller meets the minimum role', () => {
    const req = makeReq('ADMIN');
    const result = requireRole(req, 'MEMBER');
    expect(result).toBeNull();
  });

  test('returns 403 with insufficient-role when caller rank is too low', async () => {
    const req = makeReq('VIEWER');
    const result = requireRole(req, 'ADMIN');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    const body = await result!.json();
    expect(body.name).toBe('insufficient-role');
  });

  test('returns 403 when callerRole is undefined', async () => {
    const req = makeReq(undefined);
    const result = requireRole(req, 'VIEWER');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    const body = await result!.json();
    expect(body.name).toBe('insufficient-role');
  });

  test('OWNER passes OWNER requirement', () => {
    const req = makeReq('OWNER');
    expect(requireRole(req, 'OWNER')).toBeNull();
  });

  test('MEMBER blocked from ADMIN-only action', async () => {
    const req = makeReq('MEMBER');
    const result = requireRole(req, 'ADMIN');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });
});
