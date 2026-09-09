import { describe, expect, it } from 'bun:test';
import type { Knex } from 'knex';
import type { ActionContext } from '../../../server/extensions/automation/common/types';
import { listArchiveAllCardsAction } from '../../../server/extensions/automation/engine/actions/list/archiveAllCards';

// Exercise the real handler; this transaction fake verifies query/payload contracts,
// not PostgreSQL execution, transaction atomicity, or engine authorization.
function fixture(listExists = true, config: Record<string, unknown> = { listId: 'list-1' }) {
  const calls: unknown[][] = [];
  const trx = ((table: string) => {
    calls.push(['table', table]);
    return {
      where(filter: Record<string, unknown>) {
        calls.push(['where', table, filter]);
        return {
          first() {
            calls.push(['first', table]);
            return Promise.resolve(listExists ? { id: 'list-1' } : undefined);
          },
          update(payload: Record<string, unknown>) {
            calls.push(['update', table, payload]);
            return Promise.resolve(2);
          },
        };
      },
    };
  }) as unknown as Knex.Transaction;
  const context = {
    action: { id: 'action-1', automation_id: 'automation-1', position: 0, action_type: 'list.archive_all_cards', config },
    trx,
  } as ActionContext;
  return { calls, context };
}

describe('list.archive_all_cards real handler', () => {
  it('checks the configured list and archives only its non-archived cards', async () => {
    const { calls, context } = fixture();
    const before = Date.now();
    await listArchiveAllCardsAction.execute(context);
    const after = Date.now();
    expect(calls).toEqual([
      ['table', 'lists'],
      ['where', 'lists', { id: 'list-1' }],
      ['first', 'lists'],
      ['table', 'cards'],
      ['where', 'cards', { list_id: 'list-1', archived: false }],
      ['update', 'cards', { archived: true, updated_at: expect.any(String) }],
    ]);
    const payload = calls[5]?.[2] as { updated_at: string };
    const timestamp = new Date(payload.updated_at);
    expect(timestamp.toISOString()).toBe(payload.updated_at);
    expect(timestamp.getTime()).toBeGreaterThanOrEqual(before);
    expect(timestamp.getTime()).toBeLessThanOrEqual(after);
  });

  it('rejects a missing list before touching cards', async () => {
    const { calls, context } = fixture(false);
    await expect(listArchiveAllCardsAction.execute(context)).rejects.toThrow('list-not-found');
    expect(calls).toEqual([
      ['table', 'lists'], ['where', 'lists', { id: 'list-1' }], ['first', 'lists'],
    ]);
  });

  it.each([{}, { listId: '' }, { listId: 42 }])('rejects invalid config %j before querying', async (config) => {
    const { calls, context } = fixture(true, config);
    await expect(listArchiveAllCardsAction.execute(context)).rejects.toThrow();
    expect(calls).toEqual([]);
  });
});
