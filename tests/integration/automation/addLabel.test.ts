import { describe, expect, it } from 'bun:test';
import type { ActionContext } from '../../../server/extensions/automation/common/types';
import { cardAddLabelAction } from '../../../server/extensions/automation/engine/actions/card/addLabel';

// Real handler and Zod validation; only the transaction is faked (no live DB).
function fixture(rows: (Record<string, unknown> | undefined)[], cardId?: string, labelId: unknown = 'label-1') {
  const calls: unknown[][] = [];
  const query = {
    where(value: Record<string, unknown>) {
      calls.push(['where', value]);
      return query;
    },
    first() {
      calls.push(['first']);
      return Promise.resolve(rows.shift());
    },
    insert(value: Record<string, unknown>) {
      calls.push(['insert', value]);
      return Promise.resolve([]);
    },
  };
  const trx = (table: string) => {
    calls.push(['table', table]);
    return query;
  };
  const context = {
    action: { config: { labelId } }, evalContext: { cardId }, trx,
  } as unknown as ActionContext;
  return { calls, execute: () => cardAddLabelAction.execute(context) };
}

const cardLookup = [['table', 'cards'], ['where', { id: 'card-1' }], ['first']];
const labelLookup = [['table', 'labels'], ['where', { id: 'label-1' }], ['first']];
const relationLookup = [
  ['table', 'card_labels'], ['where', { card_id: 'card-1', label_id: 'label-1' }], ['first'],
];

describe('card.add_label execution', () => {
  it('validates config before accessing the transaction', async () => {
    for (const labelId of ['', 42, null]) {
      const f = fixture([], 'card-1', labelId);
      await expect(f.execute()).rejects.toThrow();
      expect(f.calls).toEqual([]);
    }
  });

  it('rejects missing card ID before querying', async () => {
    const f = fixture([]);
    await expect(f.execute()).rejects.toThrow('card-id-missing');
    expect(f.calls).toEqual([]);
  });

  it('rejects absent card before querying labels', async () => {
    const f = fixture([undefined], 'card-1');
    await expect(f.execute()).rejects.toThrow('card-not-found');
    expect(f.calls).toEqual(cardLookup);
  });

  it('rejects absent label before querying associations', async () => {
    const f = fixture([{ id: 'card-1' }, undefined], 'card-1');
    await expect(f.execute()).rejects.toThrow('label-not-found');
    expect(f.calls).toEqual([...cardLookup, ...labelLookup]);
  });

  it('does not insert an existing association', async () => {
    const f = fixture([{ id: 'card-1' }, { id: 'label-1' }, { card_id: 'card-1', label_id: 'label-1' }], 'card-1');
    await f.execute();
    expect(f.calls).toEqual([...cardLookup, ...labelLookup, ...relationLookup]);
  });

  it('inserts exactly the requested association when absent', async () => {
    const f = fixture([{ id: 'card-1' }, { id: 'label-1' }, undefined], 'card-1');
    await f.execute();
    expect(f.calls).toEqual([
      ...cardLookup, ...labelLookup, ...relationLookup,
      ['table', 'card_labels'], ['insert', { card_id: 'card-1', label_id: 'label-1' }],
    ]);
  });
});
