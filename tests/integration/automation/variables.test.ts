// tests/integration/automation/variables.test.ts
// Variable substitution tests for automation action text fields (Sprint 63).
// These tests exercise substituteVariables() with mocked DB data.

import { describe, it, expect } from 'bun:test';
import { substituteVariables } from '../../../server/extensions/automation/engine/actions/variables';
import type { Knex } from 'knex';

// ── Minimal Knex transaction mock ─────────────────────────────────────────────

function makeTrxMock(data: {
  card?: Record<string, unknown>;
  list?: Record<string, unknown>;
  board?: Record<string, unknown>;
  user?: Record<string, unknown>;
}): Knex.Transaction {
  const queryBuilder = (table: string) => ({
    where: () => ({
      first: async () => {
        if (table === 'cards') return data.card ?? null;
        if (table === 'lists') return data.list ?? null;
        if (table === 'boards') return data.board ?? null;
        if (table === 'users') return data.user ?? null;
        return null;
      },
    }),
  });

  return queryBuilder as unknown as Knex.Transaction;
}

const CARD_ID = 'a1b2c3d4-e5f6-4789-abcd-ef1234567890';
const BOARD_ID = 'b2c3d4e5-f6a7-4890-a1b2-f01234567891';
const ACTOR_ID = 'c3d4e5f6-a7b8-4901-89ab-012345678902';

// ── Basic substitution ────────────────────────────────────────────────────────

describe('substituteVariables — {cardName}', () => {
  it('replaces {cardName} with the card title', async () => {
    const trx = makeTrxMock({
      card: { id: CARD_ID, title: 'My Card', list_id: 'list-1', due_date: null },
      list: { id: 'list-1', name: 'To Do' },
      board: { id: BOARD_ID, name: 'My Board' },
    });
    const result = await substituteVariables('Card: {cardName}', { cardId: CARD_ID, boardId: BOARD_ID, actorId: null, trx });
    expect(result).toBe('Card: My Card');
  });

  it('returns empty string for cardName when card has no title', async () => {
    const trx = makeTrxMock({
      card: { id: CARD_ID, title: '', list_id: 'list-1', due_date: null },
      list: { id: 'list-1', name: 'To Do' },
      board: { id: BOARD_ID, name: 'My Board' },
    });
    const result = await substituteVariables('{cardName}', { cardId: CARD_ID, boardId: BOARD_ID, actorId: null, trx });
    expect(result).toBe('');
  });
});

describe('substituteVariables — {boardName}', () => {
  it('replaces {boardName} with the board name', async () => {
    const trx = makeTrxMock({
      card: { id: CARD_ID, title: 'Card A', list_id: 'list-1', due_date: null },
      list: { id: 'list-1', name: 'Backlog' },
      board: { id: BOARD_ID, name: 'Sprint Board' },
    });
    const result = await substituteVariables('Board: {boardName}', { cardId: CARD_ID, boardId: BOARD_ID, actorId: null, trx });
    expect(result).toBe('Board: Sprint Board');
  });
});

describe('substituteVariables — {listName}', () => {
  it('replaces {listName} with the current list name', async () => {
    const trx = makeTrxMock({
      card: { id: CARD_ID, title: 'Card B', list_id: 'list-2', due_date: null },
      list: { id: 'list-2', name: 'In Progress' },
      board: { id: BOARD_ID, name: 'My Board' },
    });
    const result = await substituteVariables('List: {listName}', { cardId: CARD_ID, boardId: BOARD_ID, actorId: null, trx });
    expect(result).toBe('List: In Progress');
  });
});

describe('substituteVariables — {date}', () => {
  it('replaces {date} with today\'s ISO date (YYYY-MM-DD)', async () => {
    const trx = makeTrxMock({
      card: { id: CARD_ID, title: 'Card', list_id: 'list-1', due_date: null },
      list: { id: 'list-1', name: 'To Do' },
      board: { id: BOARD_ID, name: 'Board' },
    });
    const result = await substituteVariables('Today: {date}', { cardId: CARD_ID, boardId: BOARD_ID, actorId: null, trx });
    const today = new Date().toISOString().slice(0, 10);
    expect(result).toBe(`Today: ${today}`);
  });
});

describe('substituteVariables — {dueDate}', () => {
  it('replaces {dueDate} with the card due date when set', async () => {
    const trx = makeTrxMock({
      card: { id: CARD_ID, title: 'Card', list_id: 'list-1', due_date: '2025-12-31T00:00:00.000Z' },
      list: { id: 'list-1', name: 'To Do' },
      board: { id: BOARD_ID, name: 'Board' },
    });
    const result = await substituteVariables('Due: {dueDate}', { cardId: CARD_ID, boardId: BOARD_ID, actorId: null, trx });
    expect(result).toBe('Due: 2025-12-31');
  });

  it('replaces {dueDate} with empty string when no due date', async () => {
    const trx = makeTrxMock({
      card: { id: CARD_ID, title: 'Card', list_id: 'list-1', due_date: null },
      list: { id: 'list-1', name: 'To Do' },
      board: { id: BOARD_ID, name: 'Board' },
    });
    const result = await substituteVariables('Due: {dueDate}', { cardId: CARD_ID, boardId: BOARD_ID, actorId: null, trx });
    expect(result).toBe('Due: ');
  });
});

describe('substituteVariables — {triggerMember}', () => {
  it('replaces {triggerMember} with the actor display name', async () => {
    const trx = makeTrxMock({
      card: { id: CARD_ID, title: 'Card', list_id: 'list-1', due_date: null },
      list: { id: 'list-1', name: 'To Do' },
      board: { id: BOARD_ID, name: 'Board' },
      user: { id: ACTOR_ID, display_name: 'Alice', full_name: 'Alice Smith' },
    });
    const result = await substituteVariables('By: {triggerMember}', { cardId: CARD_ID, boardId: BOARD_ID, actorId: ACTOR_ID, trx });
    expect(result).toBe('By: Alice');
  });

  it('falls back to full_name when display_name is absent', async () => {
    const trx = makeTrxMock({
      card: { id: CARD_ID, title: 'Card', list_id: 'list-1', due_date: null },
      list: { id: 'list-1', name: 'To Do' },
      board: { id: BOARD_ID, name: 'Board' },
      user: { id: ACTOR_ID, display_name: null, full_name: 'Bob Jones' },
    });
    const result = await substituteVariables('By: {triggerMember}', { cardId: CARD_ID, boardId: BOARD_ID, actorId: ACTOR_ID, trx });
    expect(result).toBe('By: Bob Jones');
  });

  it('leaves {triggerMember} empty when actorId is null', async () => {
    const trx = makeTrxMock({
      card: { id: CARD_ID, title: 'Card', list_id: 'list-1', due_date: null },
      list: { id: 'list-1', name: 'To Do' },
      board: { id: BOARD_ID, name: 'Board' },
    });
    const result = await substituteVariables('{triggerMember}', { cardId: CARD_ID, boardId: BOARD_ID, actorId: null, trx });
    expect(result).toBe('');
  });
});

// ── Multiple variables in one string ─────────────────────────────────────────

describe('substituteVariables — multiple variables', () => {
  it('substitutes multiple variables in one pass', async () => {
    const trx = makeTrxMock({
      card: { id: CARD_ID, title: 'Fix Bug', list_id: 'list-1', due_date: null },
      list: { id: 'list-1', name: 'In Progress' },
      board: { id: BOARD_ID, name: 'Product' },
      user: { id: ACTOR_ID, display_name: 'Dev', full_name: null },
    });
    const result = await substituteVariables(
      '{cardName} on {boardName} in {listName} by {triggerMember}',
      { cardId: CARD_ID, boardId: BOARD_ID, actorId: ACTOR_ID, trx },
    );
    expect(result).toBe('Fix Bug on Product in In Progress by Dev');
  });
});

// ── Unknown variables are preserved ──────────────────────────────────────────

describe('substituteVariables — unknown variables', () => {
  it('leaves unknown variables unchanged', async () => {
    const trx = makeTrxMock({
      card: { id: CARD_ID, title: 'Card', list_id: 'list-1', due_date: null },
      list: { id: 'list-1', name: 'To Do' },
      board: { id: BOARD_ID, name: 'Board' },
    });
    const result = await substituteVariables(
      'Hello {unknownVar} and {cardName}',
      { cardId: CARD_ID, boardId: BOARD_ID, actorId: null, trx },
    );
    expect(result).toBe('Hello {unknownVar} and Card');
  });

  it('returns text unchanged when no variables are present', async () => {
    const trx = makeTrxMock({});
    const result = await substituteVariables('No variables here', {
      cardId: CARD_ID,
      boardId: BOARD_ID,
      actorId: null,
      trx,
    });
    expect(result).toBe('No variables here');
  });
});
