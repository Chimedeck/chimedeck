import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('board_notification_preferences', (table) => {
    table.boolean('only_related_to_me').notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('board_notification_preferences', (table) => {
    table.dropColumn('only_related_to_me');
  });
}
