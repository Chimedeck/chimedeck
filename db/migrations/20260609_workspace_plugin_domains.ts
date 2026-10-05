import type { Knex } from 'knex';

/**
 * Add plugin_domains column to workspaces table.
 * [why] Workspace admins can whitelist connector URL domains for plugins
 * enabled in their workspace. These domains are included in the CSP
 * frame-ancestors directive so plugin iframes can embed board pages.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('workspaces', (table) => {
    table.jsonb('plugin_domains').defaultTo(null);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('workspaces', (table) => {
    table.dropColumn('plugin_domains');
  });
}
