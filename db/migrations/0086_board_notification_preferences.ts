// db/migrations/0086_board_notification_preferences.ts
// Sprint 95 — per-board notification opt-out for individual users.
// Missing row means notifications are enabled (opt-out model).
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('board_notification_preferences', (table) => {
    table.string('id').primary();
    table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
    table.boolean('notifications_enabled').notNullable().defaultTo(true);
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['user_id', 'board_id']);
    table.index(['user_id']);
    table.index(['board_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('board_notification_preferences');
}
