// Widen checklists.title and checklist_items.title from varchar(255) to text
// so that long Trello checklist / item names don't cause a 22001 truncation error.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('checklists', (table) => {
    table.text('title').notNullable().alter();
  });

  await knex.schema.alterTable('checklist_items', (table) => {
    table.text('title').notNullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('checklists', (table) => {
    table.string('title', 255).notNullable().alter();
  });

  await knex.schema.alterTable('checklist_items', (table) => {
    table.string('title', 255).notNullable().alter();
  });
}
