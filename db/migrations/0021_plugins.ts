// db/migrations/0021_plugins.ts
// Creates plugin system tables: plugins, board_plugins, plugin_data, plugin_auth_tokens.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('plugins', (table) => {
    table.string('id').primary();
    table.text('name').notNullable();
    table.text('slug').notNullable().unique();
    table.text('description').nullable();
    table.text('icon_url').nullable();
    table.text('connector_url').nullable();
    table.text('manifest_url').nullable();
    table.text('author').nullable();
    table.text('author_email').nullable();
    table.text('support_email').nullable();
    table.specificType('categories', 'text[]').nullable();
    table.jsonb('capabilities').nullable();
    table.boolean('is_public').notNullable().defaultTo(false);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.text('api_key').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('board_plugins', (table) => {
    table.string('id').primary();
    table.string('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
    table.string('plugin_id').notNullable().references('id').inTable('plugins').onDelete('CASCADE');
    table.string('enabled_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('enabled_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('disabled_at', { useTz: true }).nullable();
    table.jsonb('config').notNullable().defaultTo('{}');
    table.unique(['board_id', 'plugin_id']);
  });

  await knex.schema.createTable('plugin_data', (table) => {
    table.string('id').primary();
    table.string('plugin_id').notNullable().references('id').inTable('plugins').onDelete('CASCADE');
    table.text('scope').notNullable(); // 'card' | 'list' | 'board' | 'member'
    table.text('resource_id').notNullable();
    table.string('user_id').nullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('key').notNullable();
    table.jsonb('value').nullable();
    table.unique(['plugin_id', 'scope', 'resource_id', 'user_id', 'key']);
  });

  await knex.schema.createTable('plugin_auth_tokens', (table) => {
    table.string('id').primary();
    table
      .string('board_plugin_id')
      .notNullable()
      .references('id')
      .inTable('board_plugins')
      .onDelete('CASCADE');
    table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('token').notNullable();
    table.text('token_type').notNullable(); // 'oauth2' | 'api_key' | 'jwt'
    table.timestamp('expires_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('plugin_auth_tokens');
  await knex.schema.dropTableIfExists('plugin_data');
  await knex.schema.dropTableIfExists('board_plugins');
  await knex.schema.dropTableIfExists('plugins');
}
