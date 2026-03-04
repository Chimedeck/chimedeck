// db/migrations/0019_card_money.ts
// Adds amount (numeric 15,4) and currency (3-char ISO 4217) columns to cards.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cards', (table) => {
    table.decimal('amount', 15, 4).nullable();
    table.string('currency', 3).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cards', (table) => {
    table.dropColumn('amount');
    table.dropColumn('currency');
  });
}
