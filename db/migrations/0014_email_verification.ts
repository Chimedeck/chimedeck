// db/migrations/0014_email_verification.ts
// Adds email verification columns to users table.
// Existing users are backfilled as verified (they pre-date this requirement).
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.boolean('email_verified').notNullable().defaultTo(false);
    table.text('verification_token').nullable();
    table.timestamp('verification_token_expires_at', { useTz: true }).nullable();
  });

  // Backfill: existing users are considered verified
  await knex('users').update({ email_verified: true });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('email_verified');
    table.dropColumn('verification_token');
    table.dropColumn('verification_token_expires_at');
  });
}
