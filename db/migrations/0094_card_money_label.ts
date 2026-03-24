// db/migrations/0094_card_money_label.ts
// Adds label column to cards for display label on money/price field (e.g. 'Price', 'Budget').
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cards', (table) => {
    table.string('money_label', 100).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cards', (table) => {
    table.dropColumn('money_label');
  });
}
