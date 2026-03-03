// db/migrations/0015_user_profile.ts
// Adds nickname column to users table.
// avatar_url already exists from migration 0002.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.text('nickname').nullable();
  });

  // Enforce uniqueness at DB level — nicknames are workspace-global identifiers
  await knex.raw('ALTER TABLE users ADD CONSTRAINT users_nickname_unique UNIQUE (nickname)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_nickname_unique');
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('nickname');
  });
}
