import type { Knex } from 'knex';

// [why] Allow multiple chat sessions (threads) per board so users can start
// fresh conversations and avoid token overload from one monolithic history.
const THREADS_TABLE = 'board_chat_threads';

export async function up(knex: Knex): Promise<void> {
  // Drop the UNIQUE constraint on board_id so we can have multiple threads per board.
  // The FK to boards remains intact — we only remove the uniqueness enforcement.
  await knex.schema.alterTable(THREADS_TABLE, (table) => {
    table.dropUnique(['board_id'], 'board_chat_threads_board_id_unique');
  });

  // Add session metadata columns.
  await knex.schema.alterTable(THREADS_TABLE, (table) => {
    table.string('name', 255).nullable();
    table.string('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
  });

  // Index for listing sessions by board, ordered by most recent activity.
  await knex.schema.alterTable(THREADS_TABLE, (table) => {
    table.index(['board_id', 'last_message_at'], 'idx_board_chat_threads_board_last_msg');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(THREADS_TABLE, (table) => {
    table.dropIndex(['board_id', 'last_message_at'], 'idx_board_chat_threads_board_last_msg');
  });

  await knex.schema.alterTable(THREADS_TABLE, (table) => {
    table.dropColumn('created_by');
    table.dropColumn('name');
  });

  // Restore uniqueness — will fail if multiple threads already exist for a board.
  await knex.schema.alterTable(THREADS_TABLE, (table) => {
    table.unique(['board_id'], { indexName: 'board_chat_threads_board_id_unique' });
  });
}
