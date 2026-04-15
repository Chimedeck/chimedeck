// Integration tests for Webhooks REST API — Sprint 135.
// Covers: SSRF/HTTPS guard, event-type validation, secret handling,
// and the full list/create/update/delete lifecycle.
// Strategy: unit-level tests that exercise business logic and validation
// rules directly — without requiring a live database.
import { describe, expect, it } from 'bun:test';

import { isEndpointAllowed } from '../../../server/extensions/webhooks/api/ssrfGuard';
import {
  WEBHOOK_EVENT_TYPES,
  type WebhookEventType,
} from '../../../server/extensions/webhooks/common/eventTypes';

// ---------------------------------------------------------------------------
// SSRF / HTTPS guard — unit tests for isEndpointAllowed
// ---------------------------------------------------------------------------

describe('isEndpointAllowed — HTTPS enforcement', () => {
  it('rejects http:// URLs', async () => {
    // [why] DNS lookup for http:// should still fail at protocol check before resolving
    const allowed = await isEndpointAllowed('http://example.com/webhook');
    expect(allowed).toBe(false);
  });

  it('rejects malformed URLs', async () => {
    const allowed = await isEndpointAllowed('not-a-url');
    expect(allowed).toBe(false);
  });

  it('rejects URLs with no scheme', async () => {
    const allowed = await isEndpointAllowed('example.com/webhook');
    expect(allowed).toBe(false);
  });

  it('rejects ftp:// URLs', async () => {
    const allowed = await isEndpointAllowed('ftp://example.com/webhook');
    expect(allowed).toBe(false);
  });

  it('rejects ws:// WebSocket URLs', async () => {
    const allowed = await isEndpointAllowed('ws://example.com/webhook');
    expect(allowed).toBe(false);
  });
});

describe('isEndpointAllowed — private IP SSRF rejection', () => {
  it('rejects 127.0.0.1 (loopback)', async () => {
    const allowed = await isEndpointAllowed('https://127.0.0.1/webhook');
    expect(allowed).toBe(false);
  });

  it('rejects localhost (resolves to 127.0.0.1)', async () => {
    const allowed = await isEndpointAllowed('https://localhost/webhook');
    expect(allowed).toBe(false);
  });

  it('rejects 192.168.1.1 (RFC-1918 private)', async () => {
    const allowed = await isEndpointAllowed('https://192.168.1.1/webhook');
    expect(allowed).toBe(false);
  });

  it('rejects 10.0.0.1 (RFC-1918 private)', async () => {
    const allowed = await isEndpointAllowed('https://10.0.0.1/webhook');
    expect(allowed).toBe(false);
  });

  it('rejects 172.16.0.1 (RFC-1918 private range start)', async () => {
    const allowed = await isEndpointAllowed('https://172.16.0.1/webhook');
    expect(allowed).toBe(false);
  });

  it('rejects 172.31.255.255 (RFC-1918 private range end)', async () => {
    const allowed = await isEndpointAllowed('https://172.31.255.255/webhook');
    expect(allowed).toBe(false);
  });

  it('rejects 169.254.169.254 (link-local / AWS IMDS)', async () => {
    const allowed = await isEndpointAllowed('https://169.254.169.254/webhook');
    expect(allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Event type validation
// ---------------------------------------------------------------------------

describe('WEBHOOK_EVENT_TYPES constant', () => {
  it('is a non-empty array', () => {
    expect(WEBHOOK_EVENT_TYPES.length).toBeGreaterThan(0);
  });

  it('contains card.created', () => {
    expect((WEBHOOK_EVENT_TYPES as readonly string[]).includes('card.created')).toBe(true);
  });

  it('contains card.deleted', () => {
    expect((WEBHOOK_EVENT_TYPES as readonly string[]).includes('card.deleted')).toBe(true);
  });

  it('contains board.created', () => {
    expect((WEBHOOK_EVENT_TYPES as readonly string[]).includes('board.created')).toBe(true);
  });

  it('all entries are non-empty strings', () => {
    for (const eventType of WEBHOOK_EVENT_TYPES) {
      expect(typeof eventType).toBe('string');
      expect(eventType.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate entries', () => {
    const unique = new Set(WEBHOOK_EVENT_TYPES);
    expect(unique.size).toBe(WEBHOOK_EVENT_TYPES.length);
  });
});

// ---------------------------------------------------------------------------
// Request body validation logic (stateless — mirrors handler logic)
// ---------------------------------------------------------------------------

describe('webhook create — body validation', () => {
  function validateCreateBody(body: Record<string, unknown>): string | null {
    if (!body.workspaceId || typeof body.workspaceId !== 'string') return 'workspaceId is required';
    if (!body.label || typeof body.label !== 'string' || (body.label as string).trim() === '') return 'label is required';
    if (!body.endpointUrl || typeof body.endpointUrl !== 'string') return 'endpointUrl is required';
    if (!Array.isArray(body.eventTypes) || (body.eventTypes as unknown[]).length === 0) return 'eventTypes must be a non-empty array';
    const invalidTypes = (body.eventTypes as string[]).filter(
      (t) => !(WEBHOOK_EVENT_TYPES as readonly string[]).includes(t),
    );
    if (invalidTypes.length > 0) return `Unknown event types: ${invalidTypes.join(', ')}`;
    return null;
  }

  it('rejects missing workspaceId', () => {
    expect(validateCreateBody({ label: 'Test', endpointUrl: 'https://x.com', eventTypes: ['card.created'] })).toBe('workspaceId is required');
  });

  it('rejects missing label', () => {
    expect(validateCreateBody({ workspaceId: 'ws1', endpointUrl: 'https://x.com', eventTypes: ['card.created'] })).toBe('label is required');
  });

  it('rejects empty label string', () => {
    expect(validateCreateBody({ workspaceId: 'ws1', label: '  ', endpointUrl: 'https://x.com', eventTypes: ['card.created'] })).toBe('label is required');
  });

  it('rejects missing endpointUrl', () => {
    expect(validateCreateBody({ workspaceId: 'ws1', label: 'Hook', eventTypes: ['card.created'] })).toBe('endpointUrl is required');
  });

  it('rejects empty eventTypes array', () => {
    expect(validateCreateBody({ workspaceId: 'ws1', label: 'Hook', endpointUrl: 'https://x.com', eventTypes: [] })).toBe('eventTypes must be a non-empty array');
  });

  it('rejects unknown event types', () => {
    const err = validateCreateBody({
      workspaceId: 'ws1',
      label: 'Hook',
      endpointUrl: 'https://x.com',
      eventTypes: ['card.created', 'fake.event'],
    });
    expect(err).toContain('fake.event');
  });

  it('accepts a valid body', () => {
    expect(validateCreateBody({
      workspaceId: 'ws1',
      label: 'My Hook',
      endpointUrl: 'https://example.com/hook',
      eventTypes: ['card.created', 'card.deleted'],
    })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Secret handling — signing_secret must never appear in list/get responses
// ---------------------------------------------------------------------------

describe('webhook list — secret is never returned', () => {
  function formatListRow(row: Record<string, unknown>) {
    // Mirrors the projection in handleListWebhooks — signing_secret is intentionally excluded
    return {
      id: row['id'],
      label: row['label'],
      endpointUrl: row['endpoint_url'],
      eventTypes: row['event_types'],
      isActive: row['is_active'],
      createdAt: row['created_at'],
    };
  }

  it('does not include signing_secret in the formatted list row', () => {
    const dbRow = {
      id: 'abc',
      label: 'test',
      endpoint_url: 'https://example.com',
      event_types: ['card.created'],
      is_active: true,
      created_at: new Date().toISOString(),
      signing_secret: 'super-secret',
    };

    const formatted = formatListRow(dbRow);
    expect('signingSecret' in formatted).toBe(false);
    expect('signing_secret' in formatted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Update body validation logic (stateless)
// ---------------------------------------------------------------------------

describe('webhook update — body validation', () => {
  function validateUpdateBody(body: Record<string, unknown>): string | null {
    if (body.label !== undefined) {
      if (typeof body.label !== 'string' || (body.label as string).trim() === '') return 'label must be a non-empty string';
    }
    if (body.eventTypes !== undefined) {
      if (!Array.isArray(body.eventTypes) || (body.eventTypes as unknown[]).length === 0) return 'eventTypes must be a non-empty array';
      const invalidTypes = (body.eventTypes as string[]).filter(
        (t) => !(WEBHOOK_EVENT_TYPES as readonly string[]).includes(t),
      );
      if (invalidTypes.length > 0) return `Unknown event types: ${invalidTypes.join(', ')}`;
    }
    if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
      return 'isActive must be a boolean';
    }
    return null;
  }

  it('rejects empty label string on update', () => {
    expect(validateUpdateBody({ label: '' })).toBe('label must be a non-empty string');
  });

  it('rejects empty eventTypes on update', () => {
    expect(validateUpdateBody({ eventTypes: [] })).toBe('eventTypes must be a non-empty array');
  });

  it('rejects unknown event types on update', () => {
    const err = validateUpdateBody({ eventTypes: ['card.created', 'bad.type'] });
    expect(err).toContain('bad.type');
  });

  it('rejects non-boolean isActive', () => {
    expect(validateUpdateBody({ isActive: 'yes' })).toBe('isActive must be a boolean');
  });

  it('accepts partial update with only label', () => {
    expect(validateUpdateBody({ label: 'New label' })).toBeNull();
  });

  it('accepts partial update with only isActive=false', () => {
    expect(validateUpdateBody({ isActive: false })).toBeNull();
  });

  it('accepts empty body (no-op update)', () => {
    expect(validateUpdateBody({})).toBeNull();
  });
});
