// db/migrations/0027_board_extensions.ts
// Adds visibility (enum), description (text), and background (varchar) to boards (Sprint 46).
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('boards', (table) => {
    table.enu('visibility', ['PUBLIC', 'PRIVATE', 'WORKSPACE']).notNullable().defaultTo('PRIVATE');
    table.text('description').nullable();
    table.string('background', 255).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('boards', (table) => {
    table.dropColumn('visibility');
    table.dropColumn('description');
    table.dropColumn('background');
  });
}
