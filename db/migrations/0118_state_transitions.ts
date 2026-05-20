import type { Knex } from 'knex';

const TABLE_NAME = 'board_state_transitions';
const BOARD_ID_INDEX = 'idx_bst_board_id';

const DEFAULT_GRAPH = `'{"nodes":[],"edges":[],"notes":[]}'::jsonb`;

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE_NAME, (table) => {
    table.string('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    // [context] One transitions graph per board; updates replace this single row.
    table.string('board_id').notNullable().unique().references('id').inTable('boards').onDelete('CASCADE');
    table.boolean('enabled').notNullable().defaultTo(false);
    table.jsonb('graph_data').notNullable().defaultTo(knex.raw(DEFAULT_GRAPH));
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.index(['board_id'], BOARD_ID_INDEX);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE_NAME);
}
