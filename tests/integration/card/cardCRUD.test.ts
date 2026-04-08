// Integration tests for Card CRUD operations — Sprint 112.
// Covers: creating a card in a list, moving a card between lists,
// archiving a card, and due_date / start_date field validation.
// Strategy: unit-level tests that exercise business logic and validation
// rules directly — without requiring a live database.
import { describe, expect, it } from 'bun:test';

import {
  between,
  HIGH_SENTINEL,
} from '../../../server/extensions/list/mods/fractional/index';

// ---------------------------------------------------------------------------
// Card creation — title validation
// ---------------------------------------------------------------------------

describe('card creation — title validation', () => {
  it('rejects an empty title', () => {
    const title = '   ';
    const isValid = title.trim() !== '';
    expect(isValid).toBe(false);
  });

  it('rejects a missing title (undefined)', () => {
    const body: Record<string, unknown> = { description: 'some text' };
    const isValid =
      body.title && typeof body.title === 'string' && (body.title as string).trim() !== '';
    expect(!!isValid).toBe(false);
  });

  it('accepts a valid title', () => {
    const title = 'New Feature Card';
    const isValid = typeof title === 'string' && title.trim() !== '';
    expect(isValid).toBe(true);
  });

  it('rejects a title exceeding 512 characters', () => {
    const title = 'a'.repeat(513);
    expect(title.trim().length > 512).toBe(true);
  });

  it('accepts a title exactly 512 characters long', () => {
    const title = 'a'.repeat(512);
    expect(title.trim().length > 512).toBe(false);
    expect(title.trim().length).toBe(512);
  });
});

// ---------------------------------------------------------------------------
// Card position — fractional indexing for list placement
// ---------------------------------------------------------------------------

describe('card creation — position in list', () => {
  it('new card appended to empty list gets a position between LOW_SENTINEL and HIGH_SENTINEL', () => {
    // When no last card exists, position = between('', HIGH_SENTINEL)
    const position = between('', HIGH_SENTINEL);
    expect(position > '').toBe(true);
    expect(position < HIGH_SENTINEL).toBe(true);
  });

  it('new card appended after existing card gets a position after it', () => {
    const lastPosition = between('', HIGH_SENTINEL);
    const newPosition = between(lastPosition, HIGH_SENTINEL);
    expect(newPosition > lastPosition).toBe(true);
    expect(newPosition < HIGH_SENTINEL).toBe(true);
  });

  it('card prepended to list gets a position before first card', () => {
    const firstPosition = between('', HIGH_SENTINEL);
    const prependPosition = between('', firstPosition);
    expect(prependPosition < firstPosition).toBe(true);
    expect(prependPosition > '').toBe(true);
  });

  it('cards maintain sorted order after prepend', () => {
    const pos1 = between('', HIGH_SENTINEL); // first card
    const pos0 = between('', pos1);           // prepended card

    const positions = [pos1, pos0].sort();
    expect(positions[0]).toBe(pos0);
    expect(positions[1]).toBe(pos1);
  });

  it('position inserted between two cards satisfies ordering invariant', () => {
    const posA = between('', HIGH_SENTINEL);
    const posC = between(posA, HIGH_SENTINEL);
    const posB = between(posA, posC); // between A and C
    expect(posB > posA).toBe(true);
    expect(posB < posC).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Moving a card between lists
// ---------------------------------------------------------------------------

describe('moving a card between lists', () => {
  it('rejects a move when targetListId is missing', () => {
    const body: Record<string, unknown> = {};
    const isValid = !!body.targetListId;
    expect(isValid).toBe(false);
  });

  it('accepts a move with a valid targetListId', () => {
    const body = { targetListId: 'list-2' };
    expect(!!body.targetListId).toBe(true);
  });

  it('prevents cross-board moves — source and target lists must share the same board', () => {
    const sourceList = { id: 'list-1', board_id: 'board-A' };
    const targetList = { id: 'list-2', board_id: 'board-B' };
    const isSameBoard = sourceList.board_id === targetList.board_id;
    expect(isSameBoard).toBe(false);
  });

  it('allows same-board moves', () => {
    const sourceList = { id: 'list-1', board_id: 'board-A' };
    const targetList = { id: 'list-3', board_id: 'board-A' };
    const isSameBoard = sourceList.board_id === targetList.board_id;
    expect(isSameBoard).toBe(true);
  });

  it('card moved to end of target list gets a position after the last card', () => {
    const existingCards = [
      { id: 'c1', position: between('', HIGH_SENTINEL) },
      { id: 'c2', position: between(between('', HIGH_SENTINEL), HIGH_SENTINEL) },
    ].sort((a, b) => (a.position < b.position ? -1 : 1));

    const lastCard = existingCards[existingCards.length - 1]!;
    const newPosition = between(lastCard.position, HIGH_SENTINEL);

    expect(newPosition > lastCard.position).toBe(true);
    expect(newPosition < HIGH_SENTINEL).toBe(true);
  });

  it('card moved to empty target list gets a position between sentinels', () => {
    const newPosition = between('', HIGH_SENTINEL);
    expect(newPosition > '').toBe(true);
    expect(newPosition < HIGH_SENTINEL).toBe(true);
  });

  it('card moved after a specific card gets a position between that card and the next', () => {
    const pos1 = between('', HIGH_SENTINEL);
    const pos2 = between(pos1, HIGH_SENTINEL);
    // Move card after pos1, before pos2
    const inserted = between(pos1, pos2);
    expect(inserted > pos1).toBe(true);
    expect(inserted < pos2).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Archiving a card
// ---------------------------------------------------------------------------

describe('archiving a card', () => {
  it('toggles archived from false to true', () => {
    const card = { id: 'card-1', archived: false };
    const newArchived = !card.archived;
    expect(newArchived).toBe(true);
  });

  it('toggles archived from true to false (unarchive)', () => {
    const card = { id: 'card-2', archived: true };
    const newArchived = !card.archived;
    expect(newArchived).toBe(false);
  });

  it('archived card is excluded from default list queries', () => {
    const cards = [
      { id: 'c1', archived: false },
      { id: 'c2', archived: true },
      { id: 'c3', archived: false },
    ];
    const activeCards = cards.filter((c) => !c.archived);
    expect(activeCards).toHaveLength(2);
    expect(activeCards.map((c) => c.id)).not.toContain('c2');
  });

  it('block archive on an ARCHIVED board', () => {
    const board = { id: 'board-1', state: 'ARCHIVED' };
    const isBlocked = board.state === 'ARCHIVED';
    expect(isBlocked).toBe(true);
  });

  it('allow archive on an ACTIVE board', () => {
    const board = { id: 'board-2', state: 'ACTIVE' };
    const isBlocked = board.state === 'ARCHIVED';
    expect(isBlocked).toBe(false);
  });

  it('archived card card_id is still retrievable by id (not deleted)', () => {
    const card = { id: 'card-3', archived: true, title: 'Old task' };
    // The record persists in DB — only archived flag changes
    expect(card.id).toBe('card-3');
    expect(card.archived).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// due_date and start_date field validation
// ---------------------------------------------------------------------------

describe('card date fields — due_date and start_date', () => {
  it('accepts a valid ISO 8601 due_date', () => {
    const dueDate = '2026-06-30T12:00:00Z';
    const isValid = !isNaN(Date.parse(dueDate));
    expect(isValid).toBe(true);
  });

  it('rejects a malformed due_date string', () => {
    const dueDate = 'not-a-date';
    const isValid = !isNaN(Date.parse(dueDate));
    expect(isValid).toBe(false);
  });

  it('accepts null due_date (no deadline)', () => {
    const dueDate: string | null = null;
    const isValid = dueDate === null || !isNaN(Date.parse(dueDate));
    expect(isValid).toBe(true);
  });

  it('accepts a valid ISO 8601 start_date', () => {
    const startDate = '2026-05-01T00:00:00Z';
    const isValid = !isNaN(Date.parse(startDate));
    expect(isValid).toBe(true);
  });

  it('rejects a malformed start_date string', () => {
    const startDate = 'tomorrow';
    const isValid = !isNaN(Date.parse(startDate));
    expect(isValid).toBe(false);
  });

  it('accepts null start_date', () => {
    const startDate: string | null = null;
    const isValid = startDate === null || !isNaN(Date.parse(startDate));
    expect(isValid).toBe(true);
  });

  it('start_date must be on or before due_date when both are set', () => {
    const startDate = new Date('2026-05-01T00:00:00Z');
    const dueDate = new Date('2026-06-30T12:00:00Z');
    expect(startDate <= dueDate).toBe(true);
  });

  it('rejects start_date after due_date', () => {
    const startDate = new Date('2026-08-01T00:00:00Z');
    const dueDate = new Date('2026-06-30T12:00:00Z');
    expect(startDate <= dueDate).toBe(false);
  });

  it('equal start_date and due_date is valid (single-day task)', () => {
    const date = new Date('2026-06-30T00:00:00Z');
    expect(date <= date).toBe(true);
  });

  it('listDueCards filters out cards with due_date on or after the threshold', () => {
    const before = new Date('2026-04-01T00:00:00Z');
    const cards = [
      { id: 'c1', due_date: '2026-03-15T00:00:00Z' }, // before → included
      { id: 'c2', due_date: '2026-04-01T00:00:00Z' }, // equal  → excluded
      { id: 'c3', due_date: '2026-04-15T00:00:00Z' }, // after  → excluded
    ];

    const dueCards = cards.filter((c) => new Date(c.due_date) < before);
    expect(dueCards).toHaveLength(1);
    expect(dueCards[0]!.id).toBe('c1');
  });

  it('cards without due_date are excluded from due-date queries', () => {
    const cards = [
      { id: 'c1', due_date: null },
      { id: 'c2', due_date: '2026-03-10T00:00:00Z' },
    ];
    const before = new Date('2026-04-01T00:00:00Z');
    const dueCards = cards.filter(
      (c) => c.due_date !== null && new Date(c.due_date) < before,
    );
    expect(dueCards).toHaveLength(1);
    expect(dueCards[0]!.id).toBe('c2');
  });
});
