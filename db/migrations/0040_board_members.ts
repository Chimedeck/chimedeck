// db/migrations/0040_board_members.ts
// Sprint 78 — board-level membership table.
// Tracks per-board roles (ADMIN, MEMBER) independently of workspace membership.
// The board creator is inserted as ADMIN by the board creation endpoint.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('board_members', (table) => {
    table.string('id').primary();
    table.string('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
    table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.enu('role', ['ADMIN', 'MEMBER']).notNullable().defaultTo('MEMBER');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['board_id', 'user_id']);
    table.index(['board_id']);
    table.index(['user_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('board_members');
}
