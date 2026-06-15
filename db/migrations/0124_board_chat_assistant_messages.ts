import type { Knex } from 'knex';

const MESSAGES_TABLE = 'board_chat_messages';

export async function up(knex: Knex): Promise<void> {
  // [why] AI assistant responses need to be persisted alongside user messages
  // but have no human author. Make author_id nullable and add is_assistant flag.
  await knex.schema.alterTable(MESSAGES_TABLE, (table) => {
    table.boolean('is_assistant').notNullable().defaultTo(false);
    table.setNullable('author_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  // [why] Revert: drop is_assistant and restore author_id NOT NULL.
  // Any AI messages must be deleted first since they have null author_id.
  await knex(MESSAGES_TABLE).where('is_assistant', true).del();
  await knex.schema.alterTable(MESSAGES_TABLE, (table) => {
    table.dropColumn('is_assistant');
    table.dropNullable('author_id');
  });
}
