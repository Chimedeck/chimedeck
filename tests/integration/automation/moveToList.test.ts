import { describe, expect, it } from 'bun:test';
import type { ServerWebSocket } from 'bun';
import type { ActionContext } from '../../../server/extensions/automation/common/types';
import { cardMoveToListAction } from '../../../server/extensions/automation/engine/actions/card/moveToList';
import { between, HIGH_SENTINEL } from '../../../server/extensions/list/mods/fractional';
import { rooms, type WsData } from '../../../server/extensions/realtime/mods/rooms';

// Real action, fractional indexer and broadcaster; fake transaction and socket only.
function fixture({
  cardId = 'card-1',
  card = { id: 'card-1', list_id: 'source', title: 'Keep me', extra: { preserved: true } },
  list = { id: 'target', board_id: 'move-to-list-test-board' },
  peers = [{ position: 'B' }, { position: 'M' }],
  config = { listId: 'target' },
}: {
  cardId?: string;
  card?: Record<string, unknown> | null;
  list?: Record<string, unknown> | null;
  peers?: { position: string }[];
  config?: Record<string, unknown>;
} = {}) {
  const calls: unknown[][] = [];
  const updates: { list_id: string; position: string; updated_at: string }[] = [];
  const callbacks: (() => void)[] = [];
  const rows = [card, list];
  const query = {
    where(value: Record<string, unknown>) {
      calls.push(['where', value]);
      return query;
    },
    whereNot(value: Record<string, unknown>) {
      calls.push(['whereNot', value]);
      return query;
    },
    orderBy(column: string, direction: string) {
      calls.push(['orderBy', column, direction]);
      return Promise.resolve(peers);
    },
    first() {
      calls.push(['first']);
      return Promise.resolve(rows.shift());
    },
    update(value: { list_id: string; position: string; updated_at: string }) {
      calls.push(['update']);
      updates.push(value);
      return Promise.resolve(1);
    },
  };
  const trx = (table: string) => {
    calls.push(['table', table]);
    return query;
  };
  // The fake supplies exactly the context fields consumed by this action.
  const context = {
    evalContext: { actorId: 'actor-1', cardId },
    automation: { board_id: 'move-to-list-test-board' },
    action: { config },
    trx,
    postCommit(fn: () => void) { callbacks.push(fn); },
  } as unknown as ActionContext;
  return { calls, updates, callbacks, card, execute: () => cardMoveToListAction.execute(context) };
}

describe('card.move_to_list execution', () => {
  for (const [name, options, error, queries] of [
    ['invalid config', { config: { listId: '' } }, 'Too small', 0],
    ['missing card ID', { cardId: '' }, 'card-id-missing', 0],
    ['absent card', { card: null }, 'card-not-found', 1],
    ['absent target list', { list: null }, 'target-list-not-found', 2],
    ['foreign board', { list: { id: 'target', board_id: 'other' } }, 'target-list-on-different-board', 2],
  ] as const) {
    it(`rejects ${name} before peer queries, writes or callbacks`, async () => {
      const f = fixture(options);
      await expect(f.execute()).rejects.toThrow(error);
      expect(f.calls.filter(([kind]) => kind === 'table')).toHaveLength(queries);
      expect(f.calls.some(([kind]) => kind === 'orderBy')).toBe(false);
      expect(f.updates).toEqual([]);
      expect(f.callbacks).toEqual([]);
    });
  }

  for (const position of ['top', 'bottom', undefined] as const) {
    it(`moves to ${position ?? 'default bottom'} with exact filters and a deferred full-card broadcast`, async () => {
      const f = fixture({ config: { listId: 'target', position } });
      const messages: string[] = [];
      const socket = { send(message: string) { messages.push(message); return 1; } } as unknown as ServerWebSocket<WsData>;
      const boardId = 'move-to-list-test-board';
      rooms.set(boardId, new Set([socket]));
      try {
        await f.execute();
        expect(f.calls).toEqual([
          ['table', 'cards'], ['where', { id: 'card-1' }], ['first'],
          ['table', 'lists'], ['where', { id: 'target' }], ['first'],
          ['table', 'cards'], ['where', { list_id: 'target', archived: false }],
          ['whereNot', { id: 'card-1' }], ['orderBy', 'position', 'asc'],
          ['table', 'cards'], ['where', { id: 'card-1' }], ['update'],
        ]);
        const expected = position === 'top' ? between('', 'B') : between('M', HIGH_SENTINEL);
        expect(f.updates).toHaveLength(1);
        expect(f.updates[0]).toEqual({ list_id: 'target', position: expected, updated_at: expect.any(String) });
        expect(f.updates[0]?.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
        expect(messages).toEqual([]);
        expect(f.callbacks).toHaveLength(1);
        for (const callback of f.callbacks) callback();
        expect(messages).toEqual([JSON.stringify({
          type: 'card_moved',
          payload: { card: { ...f.card, list_id: 'target', position: expected }, fromListId: 'source' },
        })]);
      } finally {
        rooms.delete(boardId);
      }
    });
  }

  for (const position of ['top', 'bottom'] as const) {
    it(`uses both sentinels for an empty target at ${position}`, async () => {
      const f = fixture({ peers: [], config: { listId: 'target', position } });
      await f.execute();
      expect(f.updates[0]?.position).toBe(between('', HIGH_SENTINEL));
    });
  }
});
