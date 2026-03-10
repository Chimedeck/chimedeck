// db/migrations/0032_custom_fields.ts
// Sprint 55 — custom field definitions scoped to a board, and per-card values.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('custom_fields', (table) => {
    table.string('id').primary();
    table.string('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.enu('field_type', ['TEXT', 'NUMBER', 'DATE', 'CHECKBOX', 'DROPDOWN']).notNullable();
    table.jsonb('options').nullable(); // DROPDOWN: [{ id, label, color }]
    table.boolean('show_on_card').notNullable().defaultTo(false);
    table.integer('position').notNullable().defaultTo(0);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('card_custom_field_values', (table) => {
    table.string('id').primary();
    table.string('card_id').notNullable().references('id').inTable('cards').onDelete('CASCADE');
    table.string('custom_field_id').notNullable().references('id').inTable('custom_fields').onDelete('CASCADE');
    table.text('value_text').nullable();
    table.decimal('value_number', 15, 4).nullable();
    table.timestamp('value_date', { useTz: true }).nullable();
    table.boolean('value_checkbox').nullable();
    table.string('value_option_id', 255).nullable(); // DROPDOWN: references options[].id
    table.unique(['card_id', 'custom_field_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('card_custom_field_values');
  await knex.schema.dropTableIfExists('custom_fields');
}
