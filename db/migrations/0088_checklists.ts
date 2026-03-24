// Introduce named checklists so a single card can have multiple,
// each with their own title and ordered list of items.
import type { Knex } from 'knex';
import { randomUUID } from 'crypto';

export async function up(knex: Knex): Promise<void> {
  // 1. Create the parent checklists table
  await knex.schema.createTable('checklists', (table) => {
    table.string('id').primary();
    table.string('card_id').notNullable()
      .references('id').inTable('cards').onDelete('CASCADE');
    table.string('title').notNullable().defaultTo('Checklist');
    table.string('position').notNullable();
    table.timestamps(true, true); // created_at, updated_at
  });

  // 2. Add checklist_id FK to checklist_items (nullable — filled during migration)
  await knex.schema.table('checklist_items', (table) => {
    table.string('checklist_id').nullable()
      .references('id').inTable('checklists').onDelete('CASCADE');
  });

  // 3. Migrate existing items: create one default checklist per card that has items
  const cardIds: Array<{ card_id: string }> = await knex('checklist_items')
    .distinct('card_id')
    .select('card_id');

  for (const { card_id } of cardIds) {
    const checklistId = randomUUID();
    const position = '0|z';
    await knex('checklists').insert({
      id: checklistId,
      card_id,
      title: 'Checklist',
      position,
      created_at: new Date(),
      updated_at: new Date(),
    });
    await knex('checklist_items')
      .where({ card_id })
      .update({ checklist_id: checklistId });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('checklist_items', (table) => {
    table.dropColumn('checklist_id');
  });
  await knex.schema.dropTable('checklists');
}
