// Adds card cover fields for image/color covers.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cards', (table) => {
    table.string('cover_attachment_id').nullable().references('id').inTable('attachments').onDelete('SET NULL');
    table.string('cover_color', 16).nullable();
    table.string('cover_size', 16).notNullable().defaultTo('SMALL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cards', (table) => {
    table.dropColumn('cover_attachment_id');
    table.dropColumn('cover_color');
    table.dropColumn('cover_size');
  });
}
