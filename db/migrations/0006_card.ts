import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('cards', (table) => {
    table.string('id').primary();
    table.string('list_id').notNullable()
      .references('id').inTable('lists').onDelete('CASCADE');
    table.string('title', 512).notNullable();    // requirements §5.5 ≤ 512 chars
    table.text('description');                   // markdown
    table.string('position').notNullable();      // fractional index (same as List)
    table.boolean('archived').notNullable().defaultTo(false);
    table.timestamp('due_date');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('cards');
}
