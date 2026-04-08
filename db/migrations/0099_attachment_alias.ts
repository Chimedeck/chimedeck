// Adds a nullable alias column to the attachments table.
// The alias allows users to rename an attachment without touching the original filename.
// The original `name` is always preserved; alias is null until explicitly set.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('attachments', (table) => {
    table.string('alias', 255).nullable().defaultTo(null);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('attachments', (table) => {
    table.dropColumn('alias');
  });
}
