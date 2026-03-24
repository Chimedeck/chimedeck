// db/migrations/0087_user_notification_settings.ts
// Sprint 95 — global notification master toggle per user.
// Missing row means notifications are enabled (opt-out model).
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_notification_settings', (table) => {
    table.string('user_id').primary().references('id').inTable('users').onDelete('CASCADE');
    table.boolean('global_notifications_enabled').notNullable().defaultTo(true);
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_notification_settings');
}
