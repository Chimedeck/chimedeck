import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('lists', (table) => {
    table.string('id').primary();
    table.string('board_id').notNullable()
      .references('id').inTable('boards').onDelete('CASCADE');
    table.string('title').notNullable();
    // Lexicographic fractional index — see technical-decisions.md §7
    table.string('position').notNullable();
    table.boolean('archived').notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('lists');
}
