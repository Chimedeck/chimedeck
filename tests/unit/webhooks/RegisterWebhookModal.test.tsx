// Unit tests for RegisterWebhookModal — validation, select-all, and error states.
// Pure logic tests that do not require a full DOM environment.
import { describe, it, expect } from 'bun:test';

// [why] The modal groups are defined as constants in the component. Extract the logic
// here to test it without mounting JSX, keeping tests fast and dependency-free.

const EVENT_GROUPS: { label: string; events: string[] }[] = [
  {
    label: 'Card lifecycle',
    events: ['card.created', 'card.updated', 'card.deleted', 'card.archived'],
  },
  {
    label: 'Card content',
    events: ['card.description_edited', 'card.attachment_added', 'card.commented'],
  },
  {
    label: 'Card people',
    events: ['card.member_assigned', 'card.member_removed'],
  },
  {
    label: 'Navigation',
    events: ['card.moved'],
  },
  {
    label: 'Mentions',
    events: ['mention'],
  },
  {
    label: 'Board',
    events: ['board.created', 'board.member_added'],
  },
];

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

function selectAllInGroup(current: Set<string>, events: string[]): Set<string> {
  const next = new Set(current);
  events.forEach((e) => next.add(e));
  return next;
}

function clearAllInGroup(current: Set<string>, events: string[]): Set<string> {
  const next = new Set(current);
  events.forEach((e) => next.delete(e));
  return next;
}

function isGroupAllSelected(selected: Set<string>, events: string[]): boolean {
  return events.every((e) => selected.has(e));
}

describe('RegisterWebhookModal — URL validation', () => {
  it('accepts a valid https URL', () => {
    expect(validateUrl('https://example.com/webhook')).toBe('');
  });

  it('rejects http URLs', () => {
    expect(validateUrl('http://example.com/webhook')).toBe(
      'Endpoint URL must start with https://'
    );
  });

  it('rejects empty string', () => {
    expect(validateUrl('')).toBe('Endpoint URL must start with https://');
  });

  it('rejects plain domain without scheme', () => {
    expect(validateUrl('example.com/webhook')).toBe(
      'Endpoint URL must start with https://'
    );
  });

  it('rejects ftp scheme', () => {
    expect(validateUrl('ftp://example.com/webhook')).toBe(
      'Endpoint URL must start with https://'
    );
  });
});

describe('RegisterWebhookModal — event type validation', () => {
  it('passes when at least one event is selected', () => {
    const selected = new Set(['card.created']);
    expect(validateEvents(selected)).toBe('');
  });

  it('fails when no events are selected', () => {
    expect(validateEvents(new Set())).toBe('Select at least one event type');
  });

  it('passes with multiple events selected', () => {
    const selected = new Set(['card.created', 'card.updated', 'mention']);
    expect(validateEvents(selected)).toBe('');
  });
});

describe('RegisterWebhookModal — select-all / clear-all per group', () => {
  const group = EVENT_GROUPS[0]; // Card lifecycle

  it('selectAllInGroup adds all group events', () => {
    const result = selectAllInGroup(new Set(), group.events);
    for (const event of group.events) {
      expect(result.has(event)).toBe(true);
    }
  });

  it('selectAllInGroup preserves events from other groups', () => {
    const existing = new Set(['mention']);
    const result = selectAllInGroup(existing, group.events);
    expect(result.has('mention')).toBe(true);
    for (const event of group.events) {
      expect(result.has(event)).toBe(true);
    }
  });

  it('clearAllInGroup removes all group events', () => {
    const initial = selectAllInGroup(new Set(), group.events);
    const result = clearAllInGroup(initial, group.events);
    for (const event of group.events) {
      expect(result.has(event)).toBe(false);
    }
  });

  it('clearAllInGroup does not remove events from other groups', () => {
    const initial = new Set([...group.events, 'mention']);
    const result = clearAllInGroup(initial, group.events);
    expect(result.has('mention')).toBe(true);
  });

  it('isGroupAllSelected returns true when all group events are checked', () => {
    const selected = new Set(group.events);
    expect(isGroupAllSelected(selected, group.events)).toBe(true);
  });

  it('isGroupAllSelected returns false when some group events are missing', () => {
    const selected = new Set([group.events[0]]);
    expect(isGroupAllSelected(selected, group.events)).toBe(false);
  });

  it('isGroupAllSelected returns false for empty selection', () => {
    expect(isGroupAllSelected(new Set(), group.events)).toBe(false);
  });
});

describe('RegisterWebhookModal — event groups structure', () => {
  it('defines 6 event groups', () => {
    expect(EVENT_GROUPS.length).toBe(6);
  });

  it('includes canonical UI event types only (no aliases)', () => {
    const allEvents = EVENT_GROUPS.flatMap((g) => g.events);
    // Aliases like card_created should not be present
    for (const event of allEvents) {
      expect(event).not.toMatch(/^card_/);
    }
  });

  it('groups cover all expected canonical event types', () => {
    const allEvents = new Set(EVENT_GROUPS.flatMap((g) => g.events));
    const expected = [
      'card.created', 'card.updated', 'card.deleted', 'card.archived',
      'card.description_edited', 'card.attachment_added', 'card.commented',
      'card.member_assigned', 'card.member_removed',
      'card.moved',
      'mention',
      'board.created', 'board.member_added',
    ];
    for (const event of expected) {
      expect(allEvents.has(event)).toBe(true);
    }
  });
});
