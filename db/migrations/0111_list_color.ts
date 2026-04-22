import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('lists', (table) => {
    table.string('color').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('lists', (table) => {
    table.dropColumn('color');
  });
}
