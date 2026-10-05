import { describe, expect, it } from 'bun:test';
import type { ActionContext } from '../../../server/extensions/automation/common/types';
import { cardMoveToBottomAction } from '../../../server/extensions/automation/engine/actions/card/moveToBottom';
import { between, HIGH_SENTINEL } from '../../../server/extensions/list/mods/fractional';

// Execute the real handler and fractional indexer; only the transaction is a fake.
function fixture(rows: (Record<string, unknown> | undefined)[], cardId?: string) {
  const calls: unknown[][] = [];
  const updates: { position: string; updated_at: string }[] = [];
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
      return query;
    },
    first() {
      calls.push(['first']);
      return Promise.resolve(rows.shift());
    },
    update(value: { position: string; updated_at: string }) {
      calls.push(['update']);
      updates.push(value);
      return Promise.resolve(1);
    },
  };
  const trx = (table: string) => {
    calls.push(['table', table]);
    return query;
  };
  // Only evalContext and trx are consumed by this action.
  const context = { evalContext: { actorId: 'actor-1', cardId }, trx } as unknown as ActionContext;
  return { calls, updates, execute: () => cardMoveToBottomAction.execute(context) };
}

describe('card.move_to_bottom execution', () => {
  it('rejects a missing card ID without accessing the transaction', async () => {
    const f = fixture([]);
    await expect(f.execute()).rejects.toThrow('card-id-missing');
    expect(f.calls).toEqual([]);
  });

  it('rejects an absent card without querying peers or writing', async () => {
    const f = fixture([undefined], 'card-1');
    await expect(f.execute()).rejects.toThrow('card-not-found');
    expect(f.calls).toEqual([
      ['table', 'cards'], ['where', { id: 'card-1' }], ['first'],
    ]);
    expect(f.updates).toEqual([]);
  });

  it('appends after the last active peer in the same list, excluding itself', async () => {
    const f = fixture([{ list_id: 'list-1' }, { position: 'M' }], 'card-1');
    await f.execute();
    expect(f.calls).toEqual([
      ['table', 'cards'], ['where', { id: 'card-1' }], ['first'],
      ['table', 'cards'], ['where', { list_id: 'list-1', archived: false }],
      ['whereNot', { id: 'card-1' }], ['orderBy', 'position', 'desc'], ['first'],
      ['table', 'cards'], ['where', { id: 'card-1' }], ['update'],
    ]);
    expect(f.updates).toHaveLength(1);
    expect(f.updates[0]?.position).toBe(between('M', HIGH_SENTINEL));
    expect(f.updates[0]?.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it('uses the low sentinel when there are no other active cards', async () => {
    const f = fixture([{ list_id: 'list-1' }, undefined], 'card-1');
    await f.execute();
    expect(f.updates).toHaveLength(1);
    expect(f.updates[0]?.position).toBe(between('', HIGH_SENTINEL));
  });
});
