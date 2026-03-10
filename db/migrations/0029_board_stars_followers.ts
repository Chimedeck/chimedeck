// db/migrations/0029_board_stars_followers.ts
// Adds board_stars and board_followers join tables (Sprint 48).
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('board_stars', (table) => {
    table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.primary(['user_id', 'board_id']);
  });

  await knex.schema.createTable('board_followers', (table) => {
    table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.primary(['user_id', 'board_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('board_followers');
  await knex.schema.dropTableIfExists('board_stars');
}
