// Adds nullable width and height integer columns to the attachments table.
// These store the pixel dimensions of image attachments, populated by the thumbnail worker.
// Nullable so existing rows and non-image attachments are unaffected.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasWidth = await knex.schema.hasColumn('attachments', 'width');
  const hasHeight = await knex.schema.hasColumn('attachments', 'height');
  await knex.schema.alterTable('attachments', (table) => {
    if (!hasWidth) table.integer('width').nullable().defaultTo(null);
    if (!hasHeight) table.integer('height').nullable().defaultTo(null);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('attachments', (table) => {
    table.dropColumn('width');
    table.dropColumn('height');
  });
}
