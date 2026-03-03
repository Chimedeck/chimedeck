// db/migrations/0018_card_short_url.ts
// Adds Trello-compatible short_link and short_url columns to the cards table.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cards', (table) => {
    table.string('short_link').nullable(); // e.g. "SU6aT3Jh"
    table.string('short_url').nullable();  // e.g. "https://trello.com/c/SU6aT3Jh"
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cards', (table) => {
    table.dropColumn('short_link');
    table.dropColumn('short_url');
  });
}
