import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('checklist_items', (table) => {
    table.string('assigned_member_id').nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('due_date').nullable();
    table.string('linked_card_id').nullable()
      .references('id').inTable('cards').onDelete('SET NULL');

    table.index(['assigned_member_id'], 'checklist_items_assigned_member_idx');
    table.index(['due_date'], 'checklist_items_due_date_idx');
    table.index(['linked_card_id'], 'checklist_items_linked_card_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('checklist_items', (table) => {
    table.dropIndex(['assigned_member_id'], 'checklist_items_assigned_member_idx');
    table.dropIndex(['due_date'], 'checklist_items_due_date_idx');
    table.dropIndex(['linked_card_id'], 'checklist_items_linked_card_idx');

    table.dropColumn('linked_card_id');
    table.dropColumn('due_date');
    table.dropColumn('assigned_member_id');
  });
}
