import type { Knex } from 'knex';

const THREADS_TABLE = 'board_chat_threads';
const MESSAGES_TABLE = 'board_chat_messages';
const VECTORS_TABLE = 'board_chat_message_vectors';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(THREADS_TABLE, (table) => {
    table.string('id').primary();
    table.string('board_id').notNullable().unique().references('id').inTable('boards').onDelete('CASCADE');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('last_message_at', { useTz: true }).nullable();
    table.index(['board_id'], 'idx_board_chat_threads_board_id');
    table.index(['last_message_at'], 'idx_board_chat_threads_last_message_at');
  });

  await knex.schema.createTable(MESSAGES_TABLE, (table) => {
    table.string('id').primary();
    table.string('thread_id').notNullable().references('id').inTable(THREADS_TABLE).onDelete('CASCADE');
    table.string('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
    table.string('author_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('content').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['board_id', 'created_at', 'id'], 'idx_board_chat_messages_board_created_at');
    table.index(['thread_id', 'created_at', 'id'], 'idx_board_chat_messages_thread_created_at');
  });

  await knex.schema.createTable(VECTORS_TABLE, (table) => {
    table.string('id').primary();
    table.string('message_id').notNullable().unique().references('id').inTable(MESSAGES_TABLE).onDelete('CASCADE');
    table.string('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
    table.string('provider').notNullable();
    table.string('model').notNullable();
    table.integer('dimensions').notNullable();
    table.jsonb('embedding').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['board_id'], 'idx_board_chat_message_vectors_board_id');
    table.index(['message_id'], 'idx_board_chat_message_vectors_message_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(VECTORS_TABLE);
  await knex.schema.dropTableIfExists(MESSAGES_TABLE);
  await knex.schema.dropTableIfExists(THREADS_TABLE);
}
