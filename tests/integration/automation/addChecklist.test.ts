import { describe, expect, it } from 'bun:test';
import type { ActionContext } from '../../../server/extensions/automation/common/types';
import { cardAddChecklistAction } from '../../../server/extensions/automation/engine/actions/card/addChecklist';
import { between, HIGH_SENTINEL } from '../../../server/extensions/list/mods/fractional';

// Real handler and fractional indexing; fake transaction, not live database coverage.
function fixture(config: Record<string, unknown>, options: {
  cardId?: string; missingCard?: boolean; position?: string; readError?: Error; writeError?: Error;
} = {}) {
  const calls: unknown[][] = [];
  const inserts: Record<string, unknown>[] = [];
  const trx = (table: string) => {
    calls.push(['table', table]);
    const query = {
      where(value: Record<string, unknown>) { calls.push(['where', value]); return query; },
      orderBy(column: string, direction: string) { calls.push(['orderBy', column, direction]); return query; },
      first() {
        calls.push(['first']);
        if (options.readError) return Promise.reject(options.readError);
        return Promise.resolve(table === 'cards'
          ? (options.missingCard ? undefined : { id: 'card-1' })
          : (options.position === undefined ? undefined : { position: options.position }));
      },
      insert(value: Record<string, unknown>) {
        inserts.push(value);
        return options.writeError ? Promise.reject(options.writeError) : Promise.resolve(1);
      },
    };
    return query;
  };
  const context = { action: { config }, evalContext: { cardId: options.cardId }, trx } as unknown as ActionContext;
  return { calls, inserts, execute: () => cardAddChecklistAction.execute(context) };
}

const lookup = [['table', 'cards'], ['where', { id: 'card-1' }], ['first']];
const lastItemLookup = [['table', 'checklist_items'], ['where', { card_id: 'card-1' }], ['orderBy', 'position', 'desc'], ['first']];

describe('card.add_checklist execution', () => {
  it('validates config before database access', async () => {
    const f = fixture({ name: '' }, { cardId: 'card-1' });
    await expect(f.execute()).rejects.toThrow();
    expect(f.calls).toEqual([]);
  });
  it('rejects missing card ID before database access', async () => {
    const f = fixture({ name: 'Tasks' });
    await expect(f.execute()).rejects.toThrow('card-id-missing');
    expect(f.calls).toEqual([]);
  });
  it('rejects missing cards before reading or inserting items', async () => {
    const f = fixture({ name: 'Tasks' }, { cardId: 'card-1', missingCard: true });
    await expect(f.execute()).rejects.toThrow('card-not-found');
    expect(f.calls).toEqual(lookup);
    expect(f.inserts).toEqual([]);
  });
  for (const items of [undefined, []]) {
    it(`uses the name for ${items === undefined ? 'omitted' : 'empty'} items`, async () => {
      const f = fixture({ name: 'Tasks', items }, { cardId: 'card-1' });
      await f.execute();
      expect(f.calls).toEqual([...lookup, ...lastItemLookup, ['table', 'checklist_items']]);
      expect(f.inserts).toEqual([{ id: expect.any(String), card_id: 'card-1', title: 'Tasks', checked: false, position: between('', HIGH_SENTINEL) }]);
    });
  }
  it('appends ordered items after the last position without changing titles or payload shape', async () => {
    const f = fixture({ name: 'Tasks', items: ['First', 'Second'] }, { cardId: 'card-1', position: 'U' });
    await f.execute();
    const first = between('U', HIGH_SENTINEL);
    expect(f.calls).toEqual([...lookup, ...lastItemLookup, ['table', 'checklist_items'], ['table', 'checklist_items']]);
    expect(f.inserts).toEqual([
      { id: expect.any(String), card_id: 'card-1', title: 'First', checked: false, position: first },
      { id: expect.any(String), card_id: 'card-1', title: 'Second', checked: false, position: between(first, HIGH_SENTINEL) },
    ]);
    expect(f.inserts[0]?.id).not.toBe(f.inserts[1]?.id);
  });
  it('propagates read errors without inserts', async () => {
    const error = new Error('read-failed');
    const f = fixture({ name: 'Tasks' }, { cardId: 'card-1', readError: error });
    await expect(f.execute()).rejects.toBe(error);
    expect(f.inserts).toEqual([]);
  });
  it('stops on an insert error', async () => {
    const error = new Error('write-failed');
    const f = fixture({ name: 'Tasks', items: ['First', 'Second'] }, { cardId: 'card-1', writeError: error });
    await expect(f.execute()).rejects.toBe(error);
    expect(f.inserts).toHaveLength(1);
  });
});
