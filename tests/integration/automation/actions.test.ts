// tests/integration/automation/actions.test.ts
// Integration tests for automation action handlers (Sprint 63).
// Tests list action handlers: sortByDueDate, sortByName, archiveAllCards, moveAllCards.
// Card action handler tests verify registry completeness.

import { describe, it, expect, beforeAll } from 'bun:test';

// Import actions index to register all handlers before testing.
import '../../../server/extensions/automation/engine/actions/index';

import { listSortByDueDateAction } from '../../../server/extensions/automation/engine/actions/list/sortByDueDate';
import { listSortByNameAction } from '../../../server/extensions/automation/engine/actions/list/sortByName';
import { listArchiveAllCardsAction } from '../../../server/extensions/automation/engine/actions/list/archiveAllCards';
import { listMoveAllCardsAction } from '../../../server/extensions/automation/engine/actions/list/moveAllCards';
import { getAllActionTypes, getAllActionHandlers } from '../../../server/extensions/automation/engine/registry';

// ── Registry completeness ─────────────────────────────────────────────────────

describe('Action registry', () => {
  it('registers all 18 action types (14 card + 4 list)', () => {
    const types = getAllActionTypes();
    const expectedCard = [
      'card.move_to_list',
      'card.move_to_top',
      'card.move_to_bottom',
      'card.add_label',
      'card.remove_label',
      'card.add_member',
      'card.remove_member',
      'card.set_due_date',
      'card.remove_due_date',
      'card.mark_due_complete',
      'card.add_comment',
      'card.archive',
      'card.add_checklist',
      'card.mention_members',
    ];
    const expectedList = [
      'list.sort_by_due_date',
      'list.sort_by_name',
      'list.archive_all_cards',
      'list.move_all_cards',
    ];
    for (const t of [...expectedCard, ...expectedList]) {
      expect(types).toContain(t);
    }
    expect(types.length).toBe(18);
  });

  it('all list action handlers have label and category="list"', () => {
    const listTypes = [
      'list.sort_by_due_date',
      'list.sort_by_name',
      'list.archive_all_cards',
      'list.move_all_cards',
    ];
    const handlers = getAllActionHandlers().filter((h) => listTypes.includes(h.type));
    for (const h of handlers) {
      expect(h.label).toBeDefined();
      expect(h.category).toBe('list');
    }
  });

  it('all card action handlers have category="card"', () => {
    const handlers = getAllActionHandlers().filter((h) => h.type.startsWith('card.'));
    for (const h of handlers) {
      expect(h.category).toBe('card');
    }
  });
});

// ── Config schema validation ──────────────────────────────────────────────────

describe('list.sort_by_due_date — config schema', () => {
  it('accepts a valid listId', () => {
    const result = listSortByDueDateAction.configSchema.safeParse({
      listId: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing listId', () => {
    const result = listSortByDueDateAction.configSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID listId', () => {
    const result = listSortByDueDateAction.configSchema.safeParse({ listId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});

describe('list.sort_by_name — config schema', () => {
  it('accepts a valid listId', () => {
    const result = listSortByNameAction.configSchema.safeParse({
      listId: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing listId', () => {
    const result = listSortByNameAction.configSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('list.archive_all_cards — config schema', () => {
  it('accepts a valid listId', () => {
    const result = listArchiveAllCardsAction.configSchema.safeParse({
      listId: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing listId', () => {
    const result = listArchiveAllCardsAction.configSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('list.move_all_cards — config schema', () => {
  it('accepts valid fromListId and toListId', () => {
    const result = listMoveAllCardsAction.configSchema.safeParse({
      fromListId: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
      toListId: 'b2c3d4e5-f6a7-4890-a1b2-f01234567891',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing toListId', () => {
    const result = listMoveAllCardsAction.configSchema.safeParse({
      fromListId: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID fromListId', () => {
    const result = listMoveAllCardsAction.configSchema.safeParse({
      fromListId: 'not-a-uuid',
      toListId: 'b2c3d4e5-f6a7-4890-a1b2-f01234567891',
    });
    expect(result.success).toBe(false);
  });
});

// ── Action-types endpoint ─────────────────────────────────────────────────────

describe('GET /api/v1/automation/action-types', () => {
  it('returns all 18 action types with type, label, category, and configSchema', async () => {
    const { handleGetActionTypes } = await import(
      '../../../server/extensions/automation/api/actionTypes'
    );
    const req = new Request('http://localhost/api/v1/automation/action-types');
    const res = handleGetActionTypes(req);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(18);

    for (const item of body.data as Array<{
      type: string;
      label: string;
      category: string;
      configSchema: object;
    }>) {
      expect(typeof item.type).toBe('string');
      expect(typeof item.label).toBe('string');
      expect(typeof item.category).toBe('string');
      expect(typeof item.configSchema).toBe('object');
    }
  });

  it('includes all list action types in the response', async () => {
    const { handleGetActionTypes } = await import(
      '../../../server/extensions/automation/api/actionTypes'
    );
    const req = new Request('http://localhost/api/v1/automation/action-types');
    const res = handleGetActionTypes(req);
    const body = (await res.json()) as { data: Array<{ type: string; category: string }> };
    const listActions = body.data.filter((d) => d.category === 'list');
    const listTypes = listActions.map((d) => d.type);
    expect(listTypes).toContain('list.sort_by_due_date');
    expect(listTypes).toContain('list.sort_by_name');
    expect(listTypes).toContain('list.archive_all_cards');
    expect(listTypes).toContain('list.move_all_cards');
    expect(listActions.length).toBe(4);
  });

  it('includes all card action types in the response', async () => {
    const { handleGetActionTypes } = await import(
      '../../../server/extensions/automation/api/actionTypes'
    );
    const req = new Request('http://localhost/api/v1/automation/action-types');
    const res = handleGetActionTypes(req);
    const body = (await res.json()) as { data: Array<{ type: string; category: string }> };
    const cardActions = body.data.filter((d) => d.category === 'card');
    expect(cardActions.length).toBe(14);
  });
});
