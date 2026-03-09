// db/migrations/0025_email_change.ts
// Adds columns to support the email change + re-verification flow (Sprint 40).
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.text('pending_email').nullable();
    table.text('email_change_token').nullable();
    table.timestamp('email_change_token_expires_at', { useTz: true }).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('pending_email');
    table.dropColumn('email_change_token');
    table.dropColumn('email_change_token_expires_at');
  });
}
