import { describe, expect, it } from 'bun:test';
import type { ActionContext } from '../../../server/extensions/automation/common/types';
import { cardArchiveAction } from '../../../server/extensions/automation/engine/actions/card/archive';

// Real handler, fake transaction: these tests do not exercise a live database.
function fixture(card: { id: string } | undefined, cardId?: string, readError?: Error, writeError?: Error) {
  const calls: unknown[][] = [];
  const query = {
    where(value: Record<string, unknown>) {
      calls.push(['where', value]);
      return query;
    },
    first() {
      calls.push(['first']);
      return readError ? Promise.reject(readError) : Promise.resolve(card);
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
  return { calls, execute: () => cardArchiveAction.execute(context) };
}

const lookup = [['table', 'cards'], ['where', { id: 'card-1' }], ['first']];

describe('card.archive execution', () => {
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

  it('archives only the requested card with a current ISO timestamp', async () => {
    const f = fixture({ id: 'card-1' }, 'card-1');
    const before = Date.now();
    await f.execute();
    const after = Date.now();
    expect(f.calls).toEqual([
      ...lookup, ['table', 'cards'], ['where', { id: 'card-1' }],
      ['update', { archived: true, updated_at: expect.any(String) }],
    ]);
    const payload = f.calls.at(-1)?.[1] as { updated_at: string };
    const timestamp = Date.parse(payload.updated_at);
    expect(new Date(timestamp).toISOString()).toBe(payload.updated_at);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('propagates database read errors without updating', async () => {
    const error = new Error('read-failed');
    const f = fixture(undefined, 'card-1', error);
    await expect(f.execute()).rejects.toBe(error);
    expect(f.calls).toEqual(lookup);
  });

  it('propagates database write errors', async () => {
    const error = new Error('write-failed');
    const f = fixture({ id: 'card-1' }, 'card-1', undefined, error);
    await expect(f.execute()).rejects.toBe(error);
    expect(f.calls.slice(0, -1)).toEqual([...lookup, ['table', 'cards'], ['where', { id: 'card-1' }]]);
  });
});
