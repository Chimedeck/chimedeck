// db/migrations/0096_create_board_health_check_results.ts
// Creates the board_health_check_results table for storing probe history (Sprint 115).
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('board_health_check_results', (table) => {
    table.string('id').primary();
    table
      .string('health_check_id')
      .notNullable()
      .references('id')
      .inTable('board_health_checks')
      .onDelete('CASCADE');
    table.timestamp('checked_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    // 'green' | 'amber' | 'red'
    table.text('status').notNullable();
    // null on timeout / network error
    table.integer('http_status').nullable();
    // null on network error
    table.integer('response_time_ms').nullable();
    // null on success
    table.text('error_message').nullable();
  });

  await knex.raw(
    'CREATE INDEX idx_bhcr_health_check_id ON board_health_check_results(health_check_id)',
  );
  await knex.raw(
    'CREATE INDEX idx_bhcr_checked_at ON board_health_check_results(checked_at DESC)',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('board_health_check_results');
}
