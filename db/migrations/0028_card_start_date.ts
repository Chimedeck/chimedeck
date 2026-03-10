// db/migrations/0028_card_start_date.ts
// Adds start_date (timestamp) column to cards (Sprint 46).
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cards', (table) => {
    table.timestamp('start_date', { useTz: true }).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cards', (table) => {
    table.dropColumn('start_date');
  });
}
