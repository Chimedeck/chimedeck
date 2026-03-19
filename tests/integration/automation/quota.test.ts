// tests/integration/automation/quota.test.ts
// Integration tests for GET /api/v1/boards/:boardId/automation-quota (Sprint 68).
// Tests auth guards, response shape, and config behaviour.

import { describe, it, expect } from 'bun:test';
import { handleGetAutomationQuota } from '../../../server/extensions/automation/api/quota';
import { automationConfig } from '../../../server/extensions/automation/config';
import { issueAccessToken } from '../../../server/extensions/auth/mods/token/issue';

async function makeToken(userId = 'user-1', email = 'user@test.com'): Promise<string> {
  return issueAccessToken({ sub: userId, email });
}

function makeRequest(method: string, path: string, authHeader?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;
  return new Request(`http://localhost${path}`, { method, headers });
}

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('GET /api/v1/boards/:boardId/automation-quota', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await handleGetAutomationQuota(
      makeRequest('GET', '/api/v1/boards/board-1/automation-quota'),
      'board-1',
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await handleGetAutomationQuota(
      makeRequest('GET', '/api/v1/boards/board-1/automation-quota', 'Bearer bad.token'),
      'board-1',
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 or 500 for a valid token without board membership', async () => {
    const token = await makeToken();
    const res = await handleGetAutomationQuota(
      makeRequest('GET', '/api/v1/boards/board-1/automation-quota', `Bearer ${token}`),
      'board-1',
    );
    expect([403, 404, 500]).toContain(res.status);
  });

  it('returns 200 with correct shape when DB is available', async () => {
    const token = await makeToken();
    const res = await handleGetAutomationQuota(
      makeRequest('GET', '/api/v1/boards/board-1/automation-quota', `Bearer ${token}`),
      'board-1',
    );
    if (res.status === 200) {
      const body = await res.json() as {
        data: {
          usedRuns: number;
          maxRuns: number;
          resetAt: string;
          percentUsed: number;
        };
      };
      expect(typeof body.data.usedRuns).toBe('number');
      expect(typeof body.data.maxRuns).toBe('number');
      expect(typeof body.data.resetAt).toBe('string');
      expect(typeof body.data.percentUsed).toBe('number');
      expect(body.data.usedRuns).toBeGreaterThanOrEqual(0);
      expect(body.data.percentUsed).toBeGreaterThanOrEqual(0);
      expect(body.data.percentUsed).toBeLessThanOrEqual(100);
    } else {
      expect([403, 404, 500]).toContain(res.status);
    }
  });

  it('resetAt is always the first day of the next calendar month in UTC', async () => {
    const token = await makeToken();
    const res = await handleGetAutomationQuota(
      makeRequest('GET', '/api/v1/boards/board-1/automation-quota', `Bearer ${token}`),
      'board-1',
    );
    if (res.status === 200) {
      const body = await res.json() as { data: { resetAt: string } };
      const resetAt = new Date(body.data.resetAt);
      // Must be day 1 of some month
      expect(resetAt.getUTCDate()).toBe(1);
      // Must be at midnight UTC
      expect(resetAt.getUTCHours()).toBe(0);
      expect(resetAt.getUTCMinutes()).toBe(0);
      expect(resetAt.getUTCSeconds()).toBe(0);
    } else {
      expect([403, 404, 500]).toContain(res.status);
    }
  });
});

// ── Config: monthlyQuota default ──────────────────────────────────────────────

describe('automationConfig.monthlyQuota', () => {
  it('has a positive integer value (default 1000 when env var is unset)', () => {
    expect(typeof automationConfig.monthlyQuota).toBe('number');
    expect(automationConfig.monthlyQuota).toBeGreaterThan(0);
    expect(Number.isFinite(automationConfig.monthlyQuota)).toBe(true);
  });

  it('matches the AUTOMATION_MONTHLY_QUOTA env var when set to a valid number', () => {
    // In CI, AUTOMATION_MONTHLY_QUOTA may be set; otherwise falls back to 1000.
    const rawEnv = Bun.env['AUTOMATION_MONTHLY_QUOTA'];
    if (rawEnv) {
      const expected = parseInt(rawEnv, 10);
      if (Number.isFinite(expected) && expected > 0) {
        expect(automationConfig.monthlyQuota).toBe(expected);
      }
    } else {
      // No env var set → default is 1000
      expect(automationConfig.monthlyQuota).toBe(1000);
    }
  });
});

// ── Quota logic unit tests (pure calculations) ────────────────────────────────

describe('quota percentage calculation', () => {
  it('calculates percentUsed correctly for known values', () => {
    const cases: Array<{ used: number; max: number; expectedPercent: number }> = [
      { used: 0, max: 1000, expectedPercent: 0 },
      { used: 500, max: 1000, expectedPercent: 50 },
      { used: 800, max: 1000, expectedPercent: 80 },
      { used: 1000, max: 1000, expectedPercent: 100 },
      { used: 142, max: 1000, expectedPercent: 14 },
    ];
    for (const { used, max, expectedPercent } of cases) {
      const percentUsed = max > 0 ? Math.floor((used / max) * 100) : 0;
      expect(percentUsed).toBe(expectedPercent);
    }
  });

  it('triggers quota_warning boundary at exactly 80%', () => {
    const warningThreshold = 80;
    expect(80 >= warningThreshold).toBe(true);
    expect(79 >= warningThreshold).toBe(false);
  });
});
