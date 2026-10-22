import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cards', (table) => {
    table.boolean('is_template').notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cards', (table) => {
    table.dropColumn('is_template');
  });
}
