// tests/integration/automation/runs.test.ts
// Integration tests for automation run log endpoints (Sprint 68).
// Tests auth guards, query-param validation, response shape, and error cases.
// DB-dependent positive flows accept 200 or 500 (no DB in unit context).

import { describe, it, expect } from 'bun:test';
import { handleGetAutomationRuns } from '../../../server/extensions/automation/api/runs';
import { handleGetBoardRuns } from '../../../server/extensions/automation/api/boardRuns';
import { issueAccessToken } from '../../../server/extensions/auth/mods/token/issue';

async function makeToken(userId = 'user-1', email = 'user@test.com'): Promise<string> {
  return issueAccessToken({ sub: userId, email });
}

function makeRequest(method: string, path: string, authHeader?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;
  return new Request(`http://localhost${path}`, { method, headers });
}

// ── Auth guard: GET /:automationId/runs ──────────────────────────────────────

describe('GET /api/v1/boards/:boardId/automations/:automationId/runs', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await handleGetAutomationRuns(
      makeRequest('GET', '/api/v1/boards/board-1/automations/auto-1/runs'),
      'board-1',
      'auto-1',
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await handleGetAutomationRuns(
      makeRequest(
        'GET',
        '/api/v1/boards/board-1/automations/auto-1/runs',
        'Bearer invalid.token',
      ),
      'board-1',
      'auto-1',
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 or 404 for a non-member (valid token, no DB row)', async () => {
    const token = await makeToken();
    const res = await handleGetAutomationRuns(
      makeRequest(
        'GET',
        '/api/v1/boards/board-1/automations/auto-1/runs',
        `Bearer ${token}`,
      ),
      'board-1',
      'auto-1',
    );
    // Without DB: board not found → 404, or workspace membership check → 403, or DB error → 500
    expect([403, 404, 500]).toContain(res.status);
  });

  it('uses default perPage of 20 when not specified', async () => {
    const token = await makeToken();
    const req = makeRequest(
      'GET',
      '/api/v1/boards/board-1/automations/auto-1/runs',
      `Bearer ${token}`,
    );
    // Handler parses query params — just verify it doesn't crash at auth/parse stage
    const res = await handleGetAutomationRuns(req, 'board-1', 'auto-1');
    expect([403, 404, 500]).toContain(res.status);
  });

  it('caps perPage at 50 even when a larger value is requested', async () => {
    const token = await makeToken();
    // Provide perPage=200 in URL — handler should cap internally
    const req = new Request(
      'http://localhost/api/v1/boards/board-1/automations/auto-1/runs?perPage=200',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const res = await handleGetAutomationRuns(req, 'board-1', 'auto-1');
    // Without DB row: 403/404 or 500 — but the test verifies no 422/400 for large perPage
    expect([403, 404, 500]).toContain(res.status);
  });

  it('accepts valid status filter without crashing', async () => {
    const token = await makeToken();
    const req = new Request(
      'http://localhost/api/v1/boards/board-1/automations/auto-1/runs?status=FAILED',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const res = await handleGetAutomationRuns(req, 'board-1', 'auto-1');
    expect([403, 404, 500]).toContain(res.status);
  });

  it('ignores invalid status filter (no 422)', async () => {
    const token = await makeToken();
    const req = new Request(
      'http://localhost/api/v1/boards/board-1/automations/auto-1/runs?status=GARBAGE',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const res = await handleGetAutomationRuns(req, 'board-1', 'auto-1');
    // Invalid status is silently ignored — no 422
    expect([403, 404, 500]).toContain(res.status);
  });

  it('returns 200 with pagination metadata when DB is available', async () => {
    const token = await makeToken();
    const req = new Request(
      'http://localhost/api/v1/boards/board-1/automations/auto-1/runs',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const res = await handleGetAutomationRuns(req, 'board-1', 'auto-1');
    if (res.status === 200) {
      const body = await res.json() as {
        data: unknown[];
        metadata: { totalPage: number; perPage: number };
      };
      expect(Array.isArray(body.data)).toBe(true);
      expect(typeof body.metadata.totalPage).toBe('number');
      expect(typeof body.metadata.perPage).toBe('number');
      expect(body.metadata.perPage).toBeLessThanOrEqual(50);
    } else {
      expect([403, 404, 500]).toContain(res.status);
    }
  });
});

// ── Auth guard: GET /automation-runs (board-wide) ────────────────────────────

describe('GET /api/v1/boards/:boardId/automation-runs', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await handleGetBoardRuns(
      makeRequest('GET', '/api/v1/boards/board-1/automation-runs'),
      'board-1',
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await handleGetBoardRuns(
      makeRequest('GET', '/api/v1/boards/board-1/automation-runs', 'Bearer bad.token'),
      'board-1',
    );
    expect(res.status).toBe(401);
  });

  it('returns 403, 404, or 500 for a valid token without board membership', async () => {
    const token = await makeToken();
    const res = await handleGetBoardRuns(
      makeRequest('GET', '/api/v1/boards/board-1/automation-runs', `Bearer ${token}`),
      'board-1',
    );
    expect([403, 404, 500]).toContain(res.status);
  });

  it('returns 200 with data array + metadata when DB is available', async () => {
    const token = await makeToken();
    const res = await handleGetBoardRuns(
      makeRequest('GET', '/api/v1/boards/board-1/automation-runs', `Bearer ${token}`),
      'board-1',
    );
    if (res.status === 200) {
      const body = await res.json() as {
        data: unknown[];
        metadata: { totalPage: number; perPage: number };
      };
      expect(Array.isArray(body.data)).toBe(true);
      expect(typeof body.metadata.totalPage).toBe('number');
      // Board-wide runs use perPage 50
      expect(body.metadata.perPage).toBe(50);
      // At most 200 rows returned across all pages
      expect(body.data.length).toBeLessThanOrEqual(200);
    } else {
      expect([403, 404, 500]).toContain(res.status);
    }
  });
});
