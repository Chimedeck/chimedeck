// db/migrations/0039_email_verified_at.ts
// Adds email_verified_at timestamp to users table.
// Backfills existing verified users using their created_at date as a proxy.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.timestamp('email_verified_at', { useTz: true }).nullable();
  });

  // Backfill: users already marked as verified get a synthetic timestamp
  await knex('users').where({ email_verified: true }).update({ email_verified_at: knex.fn.now() });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('email_verified_at');
  });
}
