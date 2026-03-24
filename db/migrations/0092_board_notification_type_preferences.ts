// db/migrations/0092_board_notification_type_preferences.ts
// Sprint 100 — per-board per-type notification preference flags for individual users.
// Allows overriding user-level type preferences at the board level (opt-out model).
// Missing row means the user-level preference (or default true) applies.
import type { Knex } from 'knex';

const VALID_TYPES = [
  'mention',
  'card_created',
  'card_moved',
  'card_commented',
  'card_member_assigned',
  'card_member_unassigned',
  'card_updated',
  'card_deleted',
  'card_archived',
];
const CHECK_EXPR = VALID_TYPES.map((t) => `type = '${t}'`).join(' OR ');

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('board_notification_type_preferences', (table) => {
    table.string('id').primary();
    table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
    table.text('type').notNullable();
    table.boolean('in_app_enabled').notNullable().defaultTo(true);
    table.boolean('email_enabled').notNullable().defaultTo(true);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['user_id', 'board_id', 'type']);
    table.index(['user_id', 'board_id']);
  });

  await knex.raw(
    `ALTER TABLE board_notification_type_preferences ADD CONSTRAINT board_notification_type_preferences_type_check CHECK (${CHECK_EXPR})`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('board_notification_type_preferences');
}
