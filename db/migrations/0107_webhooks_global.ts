// db/migrations/0107_webhooks_global.ts
// Make webhooks global (not workspace-scoped).
// Drops the workspace_id FK constraint and makes the column nullable
// so existing rows are preserved and the registry query no longer filters by workspace.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('webhooks', (t) => {
    t.dropForeign(['workspace_id']);
    t.string('workspace_id').nullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('webhooks', (t) => {
    t.string('workspace_id').notNullable().alter();
    t.foreign('workspace_id').references('id').inTable('workspaces').onDelete('CASCADE');
  });
}
