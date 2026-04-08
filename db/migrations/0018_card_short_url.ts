// db/migrations/0018_card_short_url.ts
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cards', (table) => {
    table.string('short_link').nullable();
    table.string('short_url').nullable(); 
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cards', (table) => {
    table.dropColumn('short_link');
    table.dropColumn('short_url');
  });
}
