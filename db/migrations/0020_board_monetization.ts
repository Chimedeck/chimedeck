// db/migrations/0020_board_monetization.ts
// Adds nullable monetization_type column to boards. Allowed values: null, 'pre-paid', 'pay-to-paid'.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('boards', (table) => {
    table.string('monetization_type').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('boards', (table) => {
    table.dropColumn('monetization_type');
  });
}
