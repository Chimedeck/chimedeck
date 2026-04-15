// Unit tests for EditWebhookModal — pre-fill, toggle, validation, and update logic.
// Pure logic tests that mirror the RegisterWebhookModal test pattern.
import { describe, it, expect } from 'bun:test';

// ---------------------------------------------------------------------------
// Pre-fill helpers (mirror of component initialisation logic)
// ---------------------------------------------------------------------------

function initFromWebhook(webhook: {
  label: string;
  endpointUrl: string;
  eventTypes: string[];
  isActive: boolean;
}) {
  return {
    label: webhook.label,
    url: webhook.endpointUrl,
    selectedEvents: new Set(webhook.eventTypes),
    isActive: webhook.isActive,
  };
}

// ---------------------------------------------------------------------------
// Validation helpers (identical rules to RegisterWebhookModal)
// ---------------------------------------------------------------------------

function validateUrl(url: string): string {
  if (!url.startsWith('https://')) {
    return 'Endpoint URL must start with https://';
  }
  return '';
}

function validateEvents(selected: Set<string>): string {
  if (selected.size === 0) {
    return 'Select at least one event type';
  }
  return '';
}

// ---------------------------------------------------------------------------
// Active toggle helper
// ---------------------------------------------------------------------------

function toggleActive(current: boolean): boolean {
  return !current;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EditWebhookModal — pre-fill from webhook data', () => {
  const webhook = {
    id: 'wh-1',
    label: 'Production server',
    endpointUrl: 'https://example.com/hook',
    eventTypes: ['card.created', 'mention'],
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
  };

  it('pre-fills label from webhook', () => {
    const state = initFromWebhook(webhook);
    expect(state.label).toBe('Production server');
  });

  it('pre-fills url from webhook.endpointUrl', () => {
    const state = initFromWebhook(webhook);
    expect(state.url).toBe('https://example.com/hook');
  });

  it('pre-fills selectedEvents from webhook.eventTypes', () => {
    const state = initFromWebhook(webhook);
    expect(state.selectedEvents.has('card.created')).toBe(true);
    expect(state.selectedEvents.has('mention')).toBe(true);
    expect(state.selectedEvents.size).toBe(2);
  });

  it('pre-fills isActive from webhook', () => {
    const state = initFromWebhook(webhook);
    expect(state.isActive).toBe(true);
  });

  it('pre-fills isActive=false for inactive webhook', () => {
    const state = initFromWebhook({ ...webhook, isActive: false });
    expect(state.isActive).toBe(false);
  });

  it('starts with empty selectedEvents when webhook has no eventTypes', () => {
    const state = initFromWebhook({ ...webhook, eventTypes: [] });
    expect(state.selectedEvents.size).toBe(0);
  });
});

describe('EditWebhookModal — active toggle', () => {
  it('toggles from true to false', () => {
    expect(toggleActive(true)).toBe(false);
  });

  it('toggles from false to true', () => {
    expect(toggleActive(false)).toBe(true);
  });

  it('double toggle returns to original value', () => {
    expect(toggleActive(toggleActive(true))).toBe(true);
  });
});

describe('EditWebhookModal — URL validation', () => {
  it('accepts https URLs', () => {
    expect(validateUrl('https://example.com/webhook')).toBe('');
  });

  it('rejects http URLs', () => {
    expect(validateUrl('http://example.com/webhook')).not.toBe('');
  });

  it('rejects empty string', () => {
    expect(validateUrl('')).not.toBe('');
  });
});

describe('EditWebhookModal — event type validation', () => {
  it('passes when at least one event is selected', () => {
    expect(validateEvents(new Set(['card.created']))).toBe('');
  });

  it('fails when no events are selected', () => {
    expect(validateEvents(new Set())).not.toBe('');
  });
});

describe('EditWebhookModal — update payload construction', () => {
  it('builds correct update payload from state', () => {
    const state = {
      id: 'wh-1',
      label: 'Updated label',
      url: 'https://newserver.com/hook',
      selectedEvents: new Set(['card.created', 'card.updated']),
      isActive: false,
    };

    const payload = {
      id: state.id,
      label: state.label,
      endpointUrl: state.url,
      eventTypes: Array.from(state.selectedEvents),
      isActive: state.isActive,
    };

    expect(payload.id).toBe('wh-1');
    expect(payload.label).toBe('Updated label');
    expect(payload.endpointUrl).toBe('https://newserver.com/hook');
    expect(payload.eventTypes).toContain('card.created');
    expect(payload.eventTypes).toContain('card.updated');
    expect(payload.isActive).toBe(false);
  });
});
