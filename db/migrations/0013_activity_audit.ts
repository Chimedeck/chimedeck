// db/migrations/0013_activity_audit.ts
// Adds ip_address and user_agent fields to activities for security audit logging.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('activities', (table) => {
    table.string('ip_address').nullable();
    table.text('user_agent').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('activities', (table) => {
    table.dropColumn('ip_address');
    table.dropColumn('user_agent');
  });
}
