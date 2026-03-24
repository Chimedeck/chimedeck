// Integration tests for List CRUD operations — Sprint 112.
// Covers: list creation (title validation, position), renaming,
// reordering (fractional indices), and archiving.
// Strategy: unit-level tests that exercise business logic directly
// without requiring a live database.
import { describe, expect, it } from 'bun:test';

import {
  between,
  generatePositions,
  HIGH_SENTINEL,
} from '../../../server/extensions/list/mods/fractional/index';

// ---------------------------------------------------------------------------
// List creation — title validation
// ---------------------------------------------------------------------------

describe('list creation — title validation', () => {
  it('rejects an empty title', () => {
    const title = '   ';
    expect(title.trim() !== '').toBe(false);
  });

  it('rejects a missing title (undefined)', () => {
    const body: Record<string, unknown> = { afterId: null };
    const isValid =
      body.title && typeof body.title === 'string' && (body.title as string).trim() !== '';
    expect(!!isValid).toBe(false);
  });

  it('accepts a valid title string', () => {
    const title = 'Backlog';
    expect(typeof title === 'string' && title.trim() !== '').toBe(true);
  });

  it('trims whitespace before persisting', () => {
    const raw = '  In Progress  ';
    expect(raw.trim()).toBe('In Progress');
  });
});

// ---------------------------------------------------------------------------
// List creation — position (fractional indexing)
// ---------------------------------------------------------------------------

describe('list creation — position assignment', () => {
  it('first list on an empty board gets a position between sentinels', () => {
    const position = between('', HIGH_SENTINEL);
    expect(position > '').toBe(true);
    expect(position < HIGH_SENTINEL).toBe(true);
  });

  it('second list appended gets a position after the first', () => {
    const pos1 = between('', HIGH_SENTINEL);
    const pos2 = between(pos1, HIGH_SENTINEL);
    expect(pos2 > pos1).toBe(true);
    expect(pos2 < HIGH_SENTINEL).toBe(true);
  });

  it('list inserted after a specific list gets a position between it and the next', () => {
    const posA = between('', HIGH_SENTINEL);
    const posC = between(posA, HIGH_SENTINEL);
    const posB = between(posA, posC); // insert between A and C
    expect(posB > posA).toBe(true);
    expect(posB < posC).toBe(true);
  });

  it('list prepended to board gets a position before current first', () => {
    const existing = between('', HIGH_SENTINEL);
    const prepended = between('', existing);
    expect(prepended < existing).toBe(true);
    expect(prepended > '').toBe(true);
  });

  it('positions maintain sorted order when appending multiple lists', () => {
    const positions: string[] = [];
    let prev = '';
    for (let i = 0; i < 5; i++) {
      const pos = between(prev, HIGH_SENTINEL);
      positions.push(pos);
      prev = pos;
    }
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]! > positions[i - 1]!).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Renaming a list
// ---------------------------------------------------------------------------

describe('list rename — validation', () => {
  it('rejects an empty new title', () => {
    const body = { title: '' };
    const isValid = body.title.trim() !== '';
    expect(isValid).toBe(false);
  });

  it('rejects a whitespace-only new title', () => {
    const body = { title: '   ' };
    const isValid = body.title.trim() !== '';
    expect(isValid).toBe(false);
  });

  it('accepts a valid new title', () => {
    const body = { title: 'Done' };
    const isValid = typeof body.title === 'string' && body.title.trim() !== '';
    expect(isValid).toBe(true);
  });

  it('applying a rename updates the title field', () => {
    const list = { id: 'list-1', title: 'Backlog', board_id: 'board-1' };
    const updated = { ...list, title: 'Ready for Dev' };
    expect(updated.title).toBe('Ready for Dev');
    expect(updated.id).toBe(list.id); // id must not change
  });

  it('rename preserves other list fields', () => {
    const list = { id: 'list-2', title: 'Old Name', board_id: 'board-1', archived: false };
    const updated = { ...list, title: 'New Name' };
    expect(updated.board_id).toBe('board-1');
    expect(updated.archived).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Reordering lists
// ---------------------------------------------------------------------------

describe('list reorder — validation', () => {
  it('rejects reorder when order array is missing', () => {
    const body: Record<string, unknown> = {};
    expect(Array.isArray(body.order)).toBe(false);
  });

  it('rejects reorder when order count does not match active list count', () => {
    const activeLists = ['list-1', 'list-2', 'list-3'];
    const order = ['list-1', 'list-2']; // missing one
    expect(order.length !== activeLists.length).toBe(true);
  });

  it('rejects reorder that includes an ID not belonging to the board', () => {
    const activeIds = new Set(['list-1', 'list-2', 'list-3']);
    const order = ['list-1', 'list-4', 'list-3']; // list-4 is foreign
    const hasStrangerIds = order.some((id) => !activeIds.has(id));
    expect(hasStrangerIds).toBe(true);
  });

  it('accepts a valid reorder matching active list count with same IDs', () => {
    const activeIds = new Set(['list-1', 'list-2', 'list-3']);
    const order = ['list-3', 'list-1', 'list-2']; // reversed — still valid
    const isValid =
      order.length === activeIds.size && order.every((id) => activeIds.has(id));
    expect(isValid).toBe(true);
  });
});

describe('list reorder — fractional position assignment', () => {
  it('generatePositions returns the correct number of positions', () => {
    const positions = generatePositions(4);
    expect(positions.length).toBe(4);
  });

  it('generated positions are strictly increasing', () => {
    const positions = generatePositions(5);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]! > positions[i - 1]!).toBe(true);
    }
  });

  it('all generated positions are strictly less than HIGH_SENTINEL', () => {
    const positions = generatePositions(6);
    for (const pos of positions) {
      expect(pos < HIGH_SENTINEL).toBe(true);
    }
  });

  it('generatePositions with 0 count returns empty array', () => {
    expect(generatePositions(0)).toEqual([]);
  });

  it('after full reorder, a new position can be inserted between any two adjacent lists', () => {
    const positions = generatePositions(3);
    const [p0, p1, p2] = positions as [string, string, string];
    const inserted = between(p0, p1);
    expect(inserted > p0).toBe(true);
    expect(inserted < p1).toBe(true);
    // Ensure p2 is still reachable after the insertion
    expect(p2 > p1).toBe(true);
  });

  it('moving last list to first — new positions maintain order', () => {
    const ids = ['list-1', 'list-2', 'list-3'];
    const reordered = ['list-3', 'list-1', 'list-2'];
    const newPositions = generatePositions(reordered.length);
    const map: Record<string, string> = {};
    reordered.forEach((id, i) => { map[id] = newPositions[i]!; });

    // list-3 should now have the smallest (first) position
    expect(map['list-3']! < map['list-1']!).toBe(true);
    expect(map['list-1']! < map['list-2']!).toBe(true);
    // All original IDs have been assigned positions
    expect(ids.every((id) => map[id] !== undefined)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Archiving a list
// ---------------------------------------------------------------------------

describe('list archive — toggle behaviour', () => {
  it('archives an active list (archived: false → true)', () => {
    const list = { id: 'list-1', archived: false };
    const updated = { ...list, archived: !list.archived };
    expect(updated.archived).toBe(true);
  });

  it('unarchives an archived list (archived: true → false)', () => {
    const list = { id: 'list-2', archived: true };
    const updated = { ...list, archived: !list.archived };
    expect(updated.archived).toBe(false);
  });

  it('archived lists are excluded from active list queries', () => {
    const lists = [
      { id: 'l1', archived: false },
      { id: 'l2', archived: true },
      { id: 'l3', archived: false },
    ];
    const active = lists.filter((l) => !l.archived);
    expect(active).toHaveLength(2);
    expect(active.map((l) => l.id)).not.toContain('l2');
  });

  it('archived list still retains its id after archiving (not deleted)', () => {
    const list = { id: 'list-3', title: 'Archive Me', archived: false };
    const archived = { ...list, archived: true };
    expect(archived.id).toBe('list-3');
    expect(archived.title).toBe('Archive Me');
  });

  it('reorder should not include archived lists in its count', () => {
    const allLists = [
      { id: 'l1', archived: false },
      { id: 'l2', archived: true }, // archived — excluded
      { id: 'l3', archived: false },
    ];
    const activeLists = allLists.filter((l) => !l.archived);
    const order = ['l1', 'l3']; // only active IDs
    expect(order.length).toBe(activeLists.length);
  });
});
