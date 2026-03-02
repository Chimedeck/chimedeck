import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.string('id').primary();
    table.string('email').notNullable().unique();
    table.string('name').notNullable();
    table.string('avatar_url');
    table.string('password_hash'); // null for OAuth-only users
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('refresh_tokens', (table) => {
    table.string('id').primary();
    table.string('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('token').notNullable().unique(); // opaque random bytes
    table.timestamp('revoked_at');
    table.timestamp('expires_at').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('refresh_tokens');
  await knex.schema.dropTable('users');
}
