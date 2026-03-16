// db/migrations/0037_notification_preferences.ts
// Sprint 70 — per-user per-type notification preference flags (opt-out model).
// Missing rows mean both channels are enabled by default.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('notification_preferences', (table) => {
    table.string('id').primary();
    table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('type').notNullable(); // 'mention' | 'card_created' | 'card_moved' | 'card_commented'
    table.boolean('in_app_enabled').notNullable().defaultTo(true);
    table.boolean('email_enabled').notNullable().defaultTo(true);
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['user_id', 'type']);
  });

  await knex.raw(
    'CREATE INDEX notification_preferences_user_idx ON notification_preferences (user_id)'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notification_preferences');
}
