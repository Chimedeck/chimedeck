// db/migrations/0097_add_expected_status_to_board_health_checks.ts
// Adds expected_status to board_health_checks so users can specify a non-2xx
// status code that should be treated as healthy (e.g. 401 for auth-protected endpoints).
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('board_health_checks', (table) => {
    // null = use default 2xx logic; integer = exact status code that means healthy
    table.integer('expected_status').nullable().defaultTo(null);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('board_health_checks', (table) => {
    table.dropColumn('expected_status');
  });
}
