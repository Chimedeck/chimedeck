// db/migrations/0042_custom_fields_position_bigint.ts
// [why] Trello 'pos' values can exceed the 32-bit integer range (e.g. 140737488355328).
// Widening from integer → bigint prevents out-of-range errors during import.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('custom_fields', (table) => {
    table.bigInteger('position').notNullable().defaultTo(0).alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('custom_fields', (table) => {
    table.integer('position').notNullable().defaultTo(0).alter();
  });
}
