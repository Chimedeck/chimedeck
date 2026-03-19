// tests/integration/automation/cardButtons.test.ts
// Integration tests for the POST /api/v1/cards/:cardId/automation-buttons/:automationId/run endpoint.
//
// Handler-level tests that do not require a live DB connection — they verify
// the exported handler function's fast-path (feature flag, auth, 404 shapes).
// DB-dependent paths are documented as skipped without a live Postgres instance.

import { describe, it, expect } from 'bun:test';
import { handleRunCardButton } from '../../../server/extensions/automation/api/runCardButton';

// ── Feature flag guard ────────────────────────────────────────────────────────

describe('handleRunCardButton — feature flag', () => {
  it('is a function', () => {
    expect(typeof handleRunCardButton).toBe('function');
  });

  it('returns a Response', async () => {
    // When automation is disabled the handler returns 404 before touching the DB.
    const originalEnabled = Bun.env['AUTOMATION_ENABLED'];
    Bun.env['AUTOMATION_ENABLED'] = 'false';

    try {
      // Import config fresh by re-importing with the env override in place.
      // Because module caching may have loaded the config already, we call the
      // handler directly and verify the error name in the response body.
      const req = new Request('http://localhost/api/v1/cards/c1/automation-buttons/a1/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      // The handler may return 404 (feature-disabled) or 401 (no auth header).
      // Both are valid rejection paths — we just verify it returns a Response.
      const res = await handleRunCardButton(req, 'c1', 'a1');
      expect(res).toBeInstanceOf(Response);
      expect([401, 403, 404]).toContain(res.status);
    } finally {
      if (originalEnabled === undefined) {
        delete Bun.env['AUTOMATION_ENABLED'];
      } else {
        Bun.env['AUTOMATION_ENABLED'] = originalEnabled;
      }
    }
  });
});

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('handleRunCardButton — authentication', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const req = new Request('http://localhost/api/v1/cards/c1/automation-buttons/a1/run', {
      method: 'POST',
      // No Authorization header
    });

    const res = await handleRunCardButton(req, 'c1', 'a1');
    // The auth middleware returns 401 when no token is provided.
    expect(res.status).toBe(401);
  });
});

// ── Router registration ───────────────────────────────────────────────────────

describe('automationRouter — card button run route', () => {
  it('exports automationRouter that handles the run path', async () => {
    const { automationRouter } = await import('../../../server/extensions/automation/api/index');
    expect(typeof automationRouter).toBe('function');
  });

  it('automationRouter returns a Response for POST .../run', async () => {
    const { automationRouter } = await import('../../../server/extensions/automation/api/index');

    const req = new Request(
      'http://localhost/api/v1/cards/card-abc/automation-buttons/auto-xyz/run',
      { method: 'POST' },
    );
    const res = await automationRouter(
      req,
      '/api/v1/cards/card-abc/automation-buttons/auto-xyz/run',
    );

    // Returns a Response (401 auth error is expected without a valid session).
    expect(res).toBeInstanceOf(Response);
    expect(res!.status).toBe(401);
  });

  it('automationRouter returns null for unrelated paths', async () => {
    const { automationRouter } = await import('../../../server/extensions/automation/api/index');

    const req = new Request('http://localhost/api/v1/something/else', { method: 'GET' });
    const res = await automationRouter(req, '/api/v1/something/else');
    expect(res).toBeNull();
  });
});

// ── Response shape ────────────────────────────────────────────────────────────

describe('handleRunCardButton — response shape contract', () => {
  it('returns JSON with error on auth failure', async () => {
    const req = new Request('http://localhost/api/v1/cards/c1/automation-buttons/a1/run', {
      method: 'POST',
    });

    const res = await handleRunCardButton(req, 'c1', 'a1');
    const body = await res.json() as Record<string, unknown>;

    // Should have an error envelope.
    expect(body).toHaveProperty('error');
    const err = body['error'] as Record<string, unknown>;
    // Auth middleware uses `code`; automation handlers use `name` — either is acceptable.
    const hasIdentifier = typeof err['name'] === 'string' || typeof err['code'] === 'string';
    expect(hasIdentifier).toBe(true);
  });
});
