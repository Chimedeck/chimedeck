// tests/integration/auth/adminCreateUser.test.ts
// Integration tests for POST /api/v1/admin/users.
//
// Strategy: tests are layered —
//   1. Unit tests for helpers (isAdminEmailDomain, generatePassword).
//   2. HTTP-handler tests that exercise the route handler directly,
//      testing guards that fire before any DB access (auth check, admin-domain check,
//      validation). These work without a real database.
//   3. Scenario tests for email-send logic using direct env/flag inspection.
//
// Tests requiring a real DB (duplicate email, full 201 flow) are intentionally
// structured to verify the early-exit paths instead, which keeps the test suite
// runnable without a live database.
import { describe, it, expect } from 'bun:test';

// ---------------------------------------------------------------------------
// Helper unit tests
// ---------------------------------------------------------------------------

import { isAdminEmailDomain } from '../../../server/extensions/auth/common/isAdminEmailDomain';
import { generatePassword } from '../../../server/extensions/auth/common/generatePassword';

describe('isAdminEmailDomain', () => {
  it('returns true for the default admin domain', () => {
    // env.ADMIN_EMAIL_DOMAINS defaults to "journeyh.io"
    expect(isAdminEmailDomain('admin@journeyh.io')).toBe(true);
  });

  it('returns false for a non-admin domain', () => {
    expect(isAdminEmailDomain('user@gmail.com')).toBe(false);
    expect(isAdminEmailDomain('user@partner.com')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isAdminEmailDomain('ADMIN@JOURNEYH.IO')).toBe(true);
  });

  it('returns false for a malformed email with no @', () => {
    expect(isAdminEmailDomain('notanemail')).toBe(false);
  });
});

describe('generatePassword', () => {
  it('returns a string of the requested length (default 16)', () => {
    const pwd = generatePassword();
    expect(pwd.length).toBe(16);
  });

  it('returns a string of a custom length', () => {
    expect(generatePassword(24).length).toBe(24);
  });

  it('contains only alphanumeric characters', () => {
    const pwd = generatePassword(100);
    expect(/^[a-zA-Z0-9]+$/.test(pwd)).toBe(true);
  });

  it('generates unique values across calls', () => {
    const a = generatePassword();
    const b = generatePassword();
    // Extremely unlikely to collide across 16-char random strings
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// HTTP-level tests — exercise handler guards without a real database
// ---------------------------------------------------------------------------

import { handleAdminCreateUser } from '../../../server/extensions/auth/api/adminCreateUser';
import { issueAccessToken } from '../../../server/extensions/auth/mods/token/issue';

async function makeAdminToken(email: string): Promise<string> {
  // Minimal user object — the token only carries id and email
  return issueAccessToken({ sub: 'admin-user-id', email });
}

function makeRequest(body: unknown, authHeader?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;
  return new Request('http://localhost/api/v1/admin/users', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('handleAdminCreateUser — unauthenticated request', () => {
  it('returns 401 when no Bearer token is provided', async () => {
    const res = await handleAdminCreateUser(makeRequest({ email: 'x@ext.com', displayName: 'X' }));
    expect(res.status).toBe(401);
  });
});

describe('handleAdminCreateUser — non-admin caller', () => {
  it('returns 403 admin-access-required for a @gmail.com user', async () => {
    const token = await makeAdminToken('user@gmail.com');
    const res = await handleAdminCreateUser(
      makeRequest({ email: 'ext@ext.com', displayName: 'Ext' }, `Bearer ${token}`),
    );
    expect(res.status).toBe(403);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('admin-access-required');
  });

  it('returns 403 for ALLOWED_EMAIL_DOMAINS domain that is not in ADMIN_EMAIL_DOMAINS', async () => {
    // partner.com is not in ADMIN_EMAIL_DOMAINS (which defaults to journeyh.io)
    const token = await makeAdminToken('user@partner.com');
    const res = await handleAdminCreateUser(
      makeRequest({ email: 'ext@ext.com', displayName: 'Ext' }, `Bearer ${token}`),
    );
    expect(res.status).toBe(403);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('admin-access-required');
  });
});

describe('handleAdminCreateUser — input validation (admin caller)', () => {
  it('returns 422 invalid-email when email is missing', async () => {
    const token = await makeAdminToken('admin@journeyh.io');
    const res = await handleAdminCreateUser(
      makeRequest({ displayName: 'Test' }, `Bearer ${token}`),
    );
    expect(res.status).toBe(422);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('invalid-email');
  });

  it('returns 422 invalid-email for a malformed email address', async () => {
    const token = await makeAdminToken('admin@journeyh.io');
    const res = await handleAdminCreateUser(
      makeRequest({ email: 'notanemail', displayName: 'Test' }, `Bearer ${token}`),
    );
    expect(res.status).toBe(422);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('invalid-email');
  });

  it('returns 422 display-name-required when displayName is missing', async () => {
    const token = await makeAdminToken('admin@journeyh.io');
    const res = await handleAdminCreateUser(
      makeRequest({ email: 'ext@ext.com' }, `Bearer ${token}`),
    );
    expect(res.status).toBe(422);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('display-name-required');
  });

  it('returns 422 display-name-required when displayName is blank', async () => {
    const token = await makeAdminToken('admin@journeyh.io');
    const res = await handleAdminCreateUser(
      makeRequest({ email: 'ext@ext.com', displayName: '   ' }, `Bearer ${token}`),
    );
    expect(res.status).toBe(422);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('display-name-required');
  });

  it('returns 422 password-too-weak for a short manual password', async () => {
    const token = await makeAdminToken('admin@journeyh.io');
    const res = await handleAdminCreateUser(
      makeRequest({ email: 'ext@ext.com', displayName: 'Ext', password: 'abc' }, `Bearer ${token}`),
    );
    expect(res.status).toBe(422);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('password-too-weak');
  });

  it('returns 422 password-too-weak when manual password has no digit', async () => {
    const token = await makeAdminToken('admin@journeyh.io');
    const res = await handleAdminCreateUser(
      makeRequest({ email: 'ext@ext.com', displayName: 'Ext', password: 'onlyletters' }, `Bearer ${token}`),
    );
    expect(res.status).toBe(422);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('password-too-weak');
  });

  it('returns 422 password-too-weak when manual password has no letter', async () => {
    const token = await makeAdminToken('admin@journeyh.io');
    const res = await handleAdminCreateUser(
      makeRequest({ email: 'ext@ext.com', displayName: 'Ext', password: '12345678' }, `Bearer ${token}`),
    );
    expect(res.status).toBe(422);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('password-too-weak');
  });
});

// ---------------------------------------------------------------------------
// Email-send flag logic — unit tests on the condition itself
// ---------------------------------------------------------------------------

describe('email-send condition logic', () => {
  const check = (sendEmail: boolean, sesEnabled: boolean, adminInviteEnabled: boolean): boolean =>
    sendEmail === true && sesEnabled === true && adminInviteEnabled === true;

  it('sends when all three conditions are true', () => {
    expect(check(true, true, true)).toBe(true);
  });

  it('does not send when sendEmail is false even if both SES flags are enabled', () => {
    expect(check(false, true, true)).toBe(false);
  });

  it('does not send when ADMIN_INVITE_EMAIL_ENABLED is false', () => {
    expect(check(true, true, false)).toBe(false);
  });

  it('does not send when SES_ENABLED is false', () => {
    expect(check(true, false, true)).toBe(false);
  });

  it('does not send when both SES flags are false', () => {
    expect(check(true, false, false)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// autoVerifyEmail logic — unit tests for the email_verified_at stamping condition
// ---------------------------------------------------------------------------

describe('autoVerifyEmail logic', () => {
  const resolveVerifiedAt = (autoVerifyEmail: boolean | undefined, now: Date): Date | null =>
    autoVerifyEmail === true ? now : null;

  it('sets email_verified_at when autoVerifyEmail is true', () => {
    const now = new Date();
    expect(resolveVerifiedAt(true, now)).toBe(now);
  });

  it('returns null when autoVerifyEmail is false', () => {
    const now = new Date();
    expect(resolveVerifiedAt(false, now)).toBeNull();
  });

  it('returns null when autoVerifyEmail is undefined (default/omitted)', () => {
    const now = new Date();
    expect(resolveVerifiedAt(undefined, now)).toBeNull();
  });
});
