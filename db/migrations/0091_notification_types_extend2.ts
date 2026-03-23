// db/migrations/0091_notification_types_extend2.ts
// Sprint 97 — extend the valid notification type CHECK constraints to include
// card_updated, card_deleted, and card_archived.
//
// Previous constraint (0038) covered: mention, card_created, card_moved,
// card_commented. Subsequent work added card_member_assigned and
// card_member_unassigned at the application layer. This migration rebuilds
// both constraints to include the full canonical list:
//
//   mention | card_created | card_moved | card_commented |
//   card_member_assigned | card_member_unassigned |
//   card_updated | card_deleted | card_archived
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
  // Drop old constraints (may or may not exist depending on environment)
  await knex.raw(
    'ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check',
  );
  await knex.raw(
    'ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_type_check',
  );

  // Recreate with extended type list
  await knex.raw(
    `ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (${CHECK_EXPR})`,
  );
  await knex.raw(
    `ALTER TABLE notification_preferences ADD CONSTRAINT notification_preferences_type_check CHECK (${CHECK_EXPR})`,
  );
}

export async function down(knex: Knex): Promise<void> {
  // Restore the previous 6-type constraint
  const PREV_TYPES = [
    'mention',
    'card_created',
    'card_moved',
    'card_commented',
    'card_member_assigned',
    'card_member_unassigned',
  ];
  const PREV_EXPR = PREV_TYPES.map((t) => `type = '${t}'`).join(' OR ');

  await knex.raw(
    'ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check',
  );
  await knex.raw(
    'ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_type_check',
  );

  await knex.raw(
    `ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (${PREV_EXPR})`,
  );
  await knex.raw(
    `ALTER TABLE notification_preferences ADD CONSTRAINT notification_preferences_type_check CHECK (${PREV_EXPR})`,
  );
}
