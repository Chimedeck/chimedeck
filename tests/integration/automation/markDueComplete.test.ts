import { describe, expect, it } from 'bun:test';
import type { ActionContext } from '../../../server/extensions/automation/common/types';
import { cardMarkDueCompleteAction } from '../../../server/extensions/automation/engine/actions/card/markDueComplete';

// Execute the real handler with a fake transaction; no live database is exercised.
function fixture(card: { due_date: Date | null } | undefined, cardId?: string, writeError?: Error) {
  const calls: unknown[][] = [];
  const query = {
    where(value: Record<string, unknown>) {
      calls.push(['where', value]);
      return query;
    },
    first() {
      calls.push(['first']);
      return Promise.resolve(card);
    },
    update(value: Record<string, unknown>) {
      calls.push(['update', value]);
      return writeError ? Promise.reject(writeError) : Promise.resolve(1);
    },
  };
  const trx = (table: string) => {
    calls.push(['table', table]);
    return query;
  };
  const context = { evalContext: { cardId }, trx } as unknown as ActionContext;
  return { calls, execute: () => cardMarkDueCompleteAction.execute(context) };
}

const lookup = [['table', 'cards'], ['where', { id: 'card-1' }], ['first']];

describe('card.mark_due_complete execution', () => {
  it('rejects missing card ID without database access', async () => {
    const f = fixture(undefined);
    await expect(f.execute()).rejects.toThrow('card-id-missing');
    expect(f.calls).toEqual([]);
  });

  it('rejects an absent card without updating', async () => {
    const f = fixture(undefined, 'card-1');
    await expect(f.execute()).rejects.toThrow('card-not-found');
    expect(f.calls).toEqual(lookup);
  });

  it('rejects a null due date without updating', async () => {
    const f = fixture({ due_date: null }, 'card-1');
    await expect(f.execute()).rejects.toThrow('card-has-no-due-date');
    expect(f.calls).toEqual(lookup);
  });

  it('updates only the requested card with completion and a current ISO timestamp', async () => {
    const f = fixture({ due_date: new Date('2026-01-01T00:00:00Z') }, 'card-1');
    const before = Date.now();
    await f.execute();
    const after = Date.now();
    expect(f.calls).toEqual([
      ...lookup, ['table', 'cards'], ['where', { id: 'card-1' }],
      ['update', { due_complete: true, updated_at: expect.any(String) }],
    ]);
    const payload = f.calls.at(-1)?.[1] as { updated_at: string };
    const timestamp = Date.parse(payload.updated_at);
    expect(new Date(timestamp).toISOString()).toBe(payload.updated_at);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('propagates database write errors', async () => {
    const error = new Error('write-failed');
    const f = fixture({ due_date: new Date() }, 'card-1', error);
    await expect(f.execute()).rejects.toBe(error);
    expect(f.calls.slice(0, -1)).toEqual([...lookup, ['table', 'cards'], ['where', { id: 'card-1' }]]);
  });
});
