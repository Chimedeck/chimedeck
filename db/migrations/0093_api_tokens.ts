// db/migrations/0093_api_tokens.ts
// Sprint 101 — API token infrastructure.
// Tokens allow users to authenticate against the API independently of the JWT session flow.
// Only the SHA-256 hash is stored; the raw value is returned once at creation and never again.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('api_tokens', (table) => {
    table.string('id').primary(); // nanoid
    table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('name').notNullable(); // user-supplied label
    table.string('token_hash').notNullable().unique(); // SHA-256 of raw token
    table.string('token_prefix', 10).notNullable(); // first 10 chars of raw token for display
    table.timestamp('expires_at', { useTz: true }).nullable();
    table.timestamp('last_used_at', { useTz: true }).nullable();
    table.timestamp('revoked_at', { useTz: true }).nullable();
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.index(['user_id']);
    table.index(['token_hash']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('api_tokens');
}
