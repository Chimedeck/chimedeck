// Adds referenced_card_id to attachments.
// When a user pastes an internal card URL as a link attachment, this FK
// stores the target card so the UI can render a rich card preview.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('attachments', (table) => {
    table
      .string('referenced_card_id')
      .nullable()
      .references('id')
      .inTable('cards')
      .onDelete('SET NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('attachments', (table) => {
    table.dropColumn('referenced_card_id');
  });
}
