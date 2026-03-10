// db/migrations/0031_user_board_view_prefs.ts
// Sprint 52 — persists per-user per-board view preference (Kanban/Table/Calendar/Timeline).
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_board_view_prefs', (table) => {
    table.string('id').primary();
    table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
    table.enu('view_type', ['KANBAN', 'TABLE', 'CALENDAR', 'TIMELINE']).notNullable().defaultTo('KANBAN');
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['user_id', 'board_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_board_view_prefs');
}
