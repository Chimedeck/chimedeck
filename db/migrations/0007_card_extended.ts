import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('labels', (table) => {
    table.string('id').primary();
    table.string('workspace_id').notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('color').notNullable(); // hex e.g. "#FF5733"
  });

  await knex.schema.createTable('card_labels', (table) => {
    table.string('card_id').notNullable()
      .references('id').inTable('cards').onDelete('CASCADE');
    table.string('label_id').notNullable()
      .references('id').inTable('labels').onDelete('CASCADE');
    table.primary(['card_id', 'label_id']);
  });

  await knex.schema.createTable('card_members', (table) => {
    table.string('card_id').notNullable()
      .references('id').inTable('cards').onDelete('CASCADE');
    table.string('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.primary(['card_id', 'user_id']);
  });

  await knex.schema.createTable('checklist_items', (table) => {
    table.string('id').primary();
    table.string('card_id').notNullable()
      .references('id').inTable('cards').onDelete('CASCADE');
    table.string('title').notNullable();
    table.boolean('checked').notNullable().defaultTo(false);
    table.string('position').notNullable(); // fractional index for reordering
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('checklist_items');
  await knex.schema.dropTable('card_members');
  await knex.schema.dropTable('card_labels');
  await knex.schema.dropTable('labels');
}
