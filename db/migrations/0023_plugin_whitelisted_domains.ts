// db/migrations/0023_plugin_whitelisted_domains.ts
// Adds whitelisted_domains (JSONB string array) to the plugins table.
// Stores the list of HTTPS origins a plugin is permitted to communicate with.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('plugins', (table) => {
    table.jsonb('whitelisted_domains').nullable().defaultTo(null);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('plugins', (table) => {
    table.dropColumn('whitelisted_domains');
  });
}
