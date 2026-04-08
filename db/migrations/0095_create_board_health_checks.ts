// db/migrations/0095_create_board_health_checks.ts
// Creates the board_health_checks table for the Health Check tab feature (Sprint 115).
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('board_health_checks', (table) => {
    table.string('id').primary();
    table.string('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
    table.text('name').notNullable();
    table.text('url').notNullable();
    // 'custom' | 'preset'
    table.text('type').notNullable().defaultTo('custom');
    // populated when type = 'preset'
    table.text('preset_key').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.string('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_board_health_checks_board_id ON board_health_checks(board_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('board_health_checks');
}
