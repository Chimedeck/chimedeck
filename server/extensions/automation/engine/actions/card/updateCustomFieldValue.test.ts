import { describe, expect, test } from 'bun:test';
import type { Knex } from 'knex';
import type { ActionContext } from '../../../common/types';
import { cardUpdateCustomFieldValueAction as handler } from './updateCustomFieldValue';

// Real action, fake transaction: verifies query/payload contracts, not PostgreSQL acceptance.
function fixture(config: Record<string, unknown>, rows: Record<string, unknown> = {}) {
  const calls: unknown[] = [];
  const data: Record<string, unknown> = {
    cards: { id: 'card', list_id: 'list' },
    lists: { id: 'list', board_id: 'board' },
    custom_fields: { id: 'field', board_id: 'board', field_type: config.fieldType, options: null },
    ...rows,
  };
  const trx = ((table: string) => ({
    where(filter: unknown) {
      calls.push({ table, filter });
      return {
        first: () => Promise.resolve(data[table]),
        update: (values: unknown) => {
          calls.push({ update: values });
          return Promise.resolve(1);
        },
      };
    },
    insert(values: unknown) {
      calls.push({ insert: values });
      return Promise.resolve([]);
    },
  })) as unknown as Knex.Transaction;
  const context: ActionContext = {
    automation: {
      id: 'automation',
      board_id: 'board',
      created_by: 'actor',
      name: 'Test',
      automation_type: 'RULE',
      is_enabled: true,
      icon: null,
      run_count: 0,
      last_run_at: null,
      created_at: new Date(0),
      updated_at: new Date(0),
    },
    action: {
      id: 'action',
      automation_id: 'automation',
      position: 0,
      action_type: handler.type,
      config: { fieldId: 'field', ...config },
    },
    event: { type: 'test', boardId: 'board', entityId: 'card', actorId: 'actor', payload: {} },
    evalContext: { cardId: 'card', actorId: 'actor' },
    trx,
    postCommit() {
      throw new Error('unexpected side effect');
    },
  };
  return { calls, context };
}

const empty = {
  value_text: null,
  value_number: null,
  value_date: null,
  value_checkbox: null,
  value_option_id: null,
};

describe('custom-field action transaction boundary', () => {
  test('scopes reads and updates the existing value without inserting', async () => {
    const { calls, context } = fixture(
      { fieldType: 'NUMBER', valueNumber: 42 },
      { card_custom_field_values: { id: 'value' } }
    );
    await handler.execute(context);
    expect(calls).toEqual([
      { table: 'cards', filter: { id: 'card' } },
      { table: 'lists', filter: { id: 'list' } },
      { table: 'custom_fields', filter: { id: 'field', board_id: 'board' } },
      { table: 'card_custom_field_values', filter: { card_id: 'card', custom_field_id: 'field' } },
      { table: 'card_custom_field_values', filter: { card_id: 'card', custom_field_id: 'field' } },
      { update: { ...empty, value_number: 42 } },
    ]);
  });

  test.each([
    [
      { fieldType: 'TEXT', valueText: 'Hello' },
      { ...empty, value_text: 'Hello' },
    ],
    [
      { fieldType: 'DATE', valueDate: '2026-01-02T03:00:00+03:00' },
      { ...empty, value_date: '2026-01-02T00:00:00.000Z' },
    ],
    [
      { fieldType: 'CHECKBOX', valueCheckbox: false },
      { ...empty, value_checkbox: false },
    ],
  ])('inserts normalized columns for %j', async (config, columns) => {
    const { calls, context } = fixture(config);
    await handler.execute(context);
    expect(calls.at(-1)).toEqual({
      insert: {
        id: expect.any(String) as unknown,
        card_id: 'card',
        custom_field_id: 'field',
        ...columns,
      },
    });
  });

  test.each([[JSON.stringify([{ id: 'option' }])], [[{ id: 'option' }]]])(
    'accepts dropdown options representation %j',
    async (options) => {
      const { calls, context } = fixture(
        { fieldType: 'DROPDOWN', valueOptionId: 'option' },
        { custom_fields: { field_type: 'DROPDOWN', options } }
      );
      await handler.execute(context);
      expect(calls.at(-1)).toEqual({
        insert: {
          id: expect.any(String) as unknown,
          card_id: 'card',
          custom_field_id: 'field',
          ...empty,
          value_option_id: 'option',
        },
      });
    }
  );

  test.each([
    [{ cards: undefined }, 'card-not-found'],
    [{ lists: undefined }, 'card-on-different-board'],
    [{ lists: { board_id: 'other' } }, 'card-on-different-board'],
    [{ custom_fields: undefined }, 'custom-field-not-found'],
    [{ custom_fields: { field_type: 'TEXT' } }, 'custom-field-type-mismatch'],
  ] as const)('rejects invalid scope or missing rows: %j', async (rows, error) => {
    const { calls, context } = fixture({ fieldType: 'NUMBER', valueNumber: 1 }, rows);
    expect(await handler.execute(context).catch((error: unknown) => error)).toEqual(
      new Error(error)
    );
    expect(
      calls.some(
        (call) =>
          typeof call === 'object' && call !== null && ('insert' in call || 'update' in call)
      )
    ).toBe(false);
  });

  test.each([[null], ['invalid json'], ['{}'], [[{ id: 'other' }]]])(
    'rejects absent dropdown option in %j',
    async (options) => {
      const { calls, context } = fixture(
        { fieldType: 'DROPDOWN', valueOptionId: 'option' },
        { custom_fields: { field_type: 'DROPDOWN', options } }
      );
      expect(await handler.execute(context).catch((error: unknown) => error)).toEqual(
        new Error('custom-field-option-not-found')
      );
      expect(calls).toHaveLength(3);
    }
  );

  test('rejects missing card ID before querying', async () => {
    const { calls, context } = fixture({ fieldType: 'NUMBER', valueNumber: 1 });
    delete context.evalContext.cardId;
    expect(await handler.execute(context).catch((error: unknown) => error)).toEqual(
      new Error('card-id-missing')
    );
    expect(calls).toEqual([]);
  });
});
