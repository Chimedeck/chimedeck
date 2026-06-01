import { describe, expect, it } from 'bun:test';
import type { Knex } from 'knex';
import { down, up } from '../../../db/migrations/20260601_workspace_subscriptions';

type RecordedColumn = {
  type: 'string' | 'enum' | 'timestamp' | 'boolean';
  name: string;
  enumValues?: string[];
};

type RecordedIndex = {
  columns: string[];
  indexName?: string;
};

type RecordedTable = {
  name: string;
  columns: RecordedColumn[];
  indexes: RecordedIndex[];
};

function createColumnChain(): {
  notNullable: () => ReturnType<typeof createColumnChain>;
  nullable: () => ReturnType<typeof createColumnChain>;
  defaultTo: (_value: unknown) => ReturnType<typeof createColumnChain>;
  unique: () => ReturnType<typeof createColumnChain>;
  primary: () => ReturnType<typeof createColumnChain>;
  references: (_value: string) => ReturnType<typeof createColumnChain>;
  inTable: (_value: string) => ReturnType<typeof createColumnChain>;
  onDelete: (_value: string) => ReturnType<typeof createColumnChain>;
} {
  return {
    notNullable: () => createColumnChain(),
    nullable: () => createColumnChain(),
    defaultTo: () => createColumnChain(),
    unique: () => createColumnChain(),
    primary: () => createColumnChain(),
    references: () => createColumnChain(),
    inTable: () => createColumnChain(),
    onDelete: () => createColumnChain(),
  };
}

function createFakeKnex() {
  const tables: RecordedTable[] = [];
  const droppedTables: string[] = [];

  const schema = {
    createTable: async (name: string, callback: (table: unknown) => void) => {
      const recorded: RecordedTable = { name, columns: [], indexes: [] };
      const table = {
        string: (columnName: string) => {
          recorded.columns.push({ type: 'string', name: columnName });
          return createColumnChain();
        },
        enu: (columnName: string, enumValues: string[]) => {
          recorded.columns.push({ type: 'enum', name: columnName, enumValues: [...enumValues] });
          return createColumnChain();
        },
        timestamp: (columnName: string) => {
          recorded.columns.push({ type: 'timestamp', name: columnName });
          return createColumnChain();
        },
        boolean: (columnName: string) => {
          recorded.columns.push({ type: 'boolean', name: columnName });
          return createColumnChain();
        },
        index: (columns: string[], indexName?: string) => {
          recorded.indexes.push({ columns, indexName });
        },
      };
      callback(table);
      tables.push(recorded);
    },
    alterTable: async (name: string, callback: (table: unknown) => void) => {
      const recorded = tables.find((table) => table.name === name);
      if (!recorded) throw new Error(`missing-table-${name}`);
      const table = {
        index: (columns: string[], indexName?: string) => {
          recorded.indexes.push({ columns, indexName });
        },
      };
      callback(table);
    },
    dropTableIfExists: async (name: string) => {
      droppedTables.push(name);
    },
  };

  const fakeKnex = {
    schema,
    fn: {
      now: () => 'NOW()',
    },
  } as unknown as Knex;

  return { fakeKnex, tables, droppedTables };
}

describe('20260601_workspace_subscriptions migration', () => {
  it('creates workspace_subscriptions table with expected columns', async () => {
    const { fakeKnex, tables } = createFakeKnex();
    await up(fakeKnex);

    const table = tables.find((item) => item.name === 'workspace_subscriptions');
    expect(table).toBeDefined();
    expect(table?.columns.map((column) => column.name)).toEqual([
      'workspace_id',
      'tier',
      'status',
      'stripe_customer_id',
      'stripe_subscription_id',
      'stripe_price_id',
      'stripe_current_period_end',
      'created_at',
      'updated_at',
    ]);

    const tier = table?.columns.find((column) => column.name === 'tier');
    expect(tier?.type).toBe('enum');
    expect(tier?.enumValues).toEqual(['tier_1', 'tier_2', 'unlimited']);

    const status = table?.columns.find((column) => column.name === 'status');
    expect(status?.type).toBe('enum');
    expect(status?.enumValues).toEqual([
      'active',
      'trialing',
      'past_due',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'unpaid',
    ]);

    expect(table?.indexes).toContainEqual({
      columns: ['workspace_id'],
      indexName: 'idx_workspace_subscriptions_workspace_id',
    });
  });

  it('drops workspace_subscriptions table on rollback', async () => {
    const { fakeKnex, droppedTables } = createFakeKnex();
    await down(fakeKnex);
    expect(droppedTables).toEqual(['workspace_subscriptions']);
  });
});
