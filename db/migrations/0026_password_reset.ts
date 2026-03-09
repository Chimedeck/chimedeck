// db/migrations/0026_password_reset.ts
// Adds columns to support the forgot-password / password-reset flow (Sprint 41).
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.text('password_reset_token').nullable();
    table.timestamp('password_reset_token_expires_at', { useTz: true }).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('password_reset_token');
    table.dropColumn('password_reset_token_expires_at');
  });
}
