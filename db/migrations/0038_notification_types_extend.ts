// db/migrations/0038_notification_types_extend.ts
// Sprint 73 — document and enforce the valid notification type values.
//
// The notification_preferences table (0037) and the notifications table
// both use a free-text `type` column. This migration adds a CHECK constraint
// to both tables so the set of valid types is enforced at the DB level:
//   mention | card_created | card_moved | card_commented
//
// Backward compatibility: all rows that exist in production already use one
// of these values — the constraint addition is safe.
import type { Knex } from 'knex';

const VALID_TYPES = ['mention', 'card_created', 'card_moved', 'card_commented'];
const CHECK_EXPR = VALID_TYPES.map((t) => `type = '${t}'`).join(' OR ');

export async function up(knex: Knex): Promise<void> {
  // notifications table constraint
  await knex.raw(
    `ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (${CHECK_EXPR})`,
  );

  // notification_preferences table constraint
  await knex.raw(
    `ALTER TABLE notification_preferences ADD CONSTRAINT notification_preferences_type_check CHECK (${CHECK_EXPR})`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    'ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check',
  );
  await knex.raw(
    'ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_type_check',
  );
}
