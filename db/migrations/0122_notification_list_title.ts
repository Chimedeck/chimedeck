// db/migrations/0122_notification_list_title.ts
// Adds list_title to notifications so card_moved notifications preserve the
// historical destination list name. Previously list_title was resolved at
// query time via JOIN on cards.list_id (current list), causing all card_moved
// notifications for a card to show the same (latest) destination.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('notifications', (table) => {
    table.text('list_title').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('notifications', (table) => {
    table.dropColumn('list_title');
  });
}
