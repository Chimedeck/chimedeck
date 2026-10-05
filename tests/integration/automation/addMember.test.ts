import { describe, expect, it } from 'bun:test';
import type { ActionContext } from '../../../server/extensions/automation/common/types';
import { cardAddMemberAction } from '../../../server/extensions/automation/engine/actions/card/addMember';

// Real handler and Zod validation; only the transaction is faked (no live DB).
function fixture(rows: (Record<string, unknown> | undefined)[], cardId?: string, memberId: unknown = 'member-1') {
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
    action: { config: { memberId } }, evalContext: { cardId }, trx,
  } as unknown as ActionContext;
  return { calls, execute: () => cardAddMemberAction.execute(context) };
}

const cardLookup = [['table', 'cards'], ['where', { id: 'card-1' }], ['first']];
const memberLookup = [['table', 'users'], ['where', { id: 'member-1' }], ['first']];
const relationLookup = [
  ['table', 'card_members'], ['where', { card_id: 'card-1', user_id: 'member-1' }], ['first'],
];

describe('card.add_member execution', () => {
  it('validates config before accessing the transaction', async () => {
    for (const memberId of ['', 42, null]) {
      const f = fixture([], 'card-1', memberId);
      await expect(f.execute()).rejects.toThrow();
      expect(f.calls).toEqual([]);
    }
  });

  it('rejects missing card ID before querying', async () => {
    const f = fixture([]);
    await expect(f.execute()).rejects.toThrow('card-id-missing');
    expect(f.calls).toEqual([]);
  });

  it('rejects absent card before querying users', async () => {
    const f = fixture([undefined], 'card-1');
    await expect(f.execute()).rejects.toThrow('card-not-found');
    expect(f.calls).toEqual(cardLookup);
  });

  it('rejects absent member before querying associations', async () => {
    const f = fixture([{ id: 'card-1' }, undefined], 'card-1');
    await expect(f.execute()).rejects.toThrow('member-not-found');
    expect(f.calls).toEqual([...cardLookup, ...memberLookup]);
  });

  it('does not insert an existing association', async () => {
    const f = fixture([{ id: 'card-1' }, { id: 'member-1' }, { card_id: 'card-1', user_id: 'member-1' }], 'card-1');
    await f.execute();
    expect(f.calls).toEqual([...cardLookup, ...memberLookup, ...relationLookup]);
  });

  it('inserts exactly the requested association with a current ISO timestamp when absent', async () => {
    const f = fixture([{ id: 'card-1' }, { id: 'member-1' }, undefined], 'card-1');
    const before = Date.now();
    await f.execute();
    const after = Date.now();
    expect(f.calls).toEqual([
      ...cardLookup, ...memberLookup, ...relationLookup,
      ['table', 'card_members'],
      ['insert', { card_id: 'card-1', user_id: 'member-1', created_at: expect.any(String) }],
    ]);
    const payload = f.calls.at(-1)?.[1] as { created_at: string };
    const timestamp = Date.parse(payload.created_at);
    expect(new Date(timestamp).toISOString()).toBe(payload.created_at);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});
