// db/migrations/0112_notification_types_extend3_comment_reaction.ts
// Extend notification type CHECK constraints to include comment_reaction.
import type { Knex } from 'knex';

const VALID_TYPES = [
  'mention',
  'card_created',
  'card_moved',
  'card_commented',
  'comment_reaction',
  'card_member_assigned',
  'card_member_unassigned',
  'card_updated',
  'card_deleted',
  'card_archived',
];

const PREV_TYPES = [
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

function buildCheckExpr(types: string[]): string {
  return types.map((type) => `type = '${type}'`).join(' OR ');
}

export async function up(knex: Knex): Promise<void> {
  const checkExpr = buildCheckExpr(VALID_TYPES);

  await knex.raw('ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check');
  await knex.raw('ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_type_check');
  await knex.raw('ALTER TABLE board_notification_type_preferences DROP CONSTRAINT IF EXISTS board_notification_type_preferences_type_check');

  await knex.raw(`ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (${checkExpr})`);
  await knex.raw(`ALTER TABLE notification_preferences ADD CONSTRAINT notification_preferences_type_check CHECK (${checkExpr})`);
  await knex.raw(`ALTER TABLE board_notification_type_preferences ADD CONSTRAINT board_notification_type_preferences_type_check CHECK (${checkExpr})`);
}

export async function down(knex: Knex): Promise<void> {
  const prevExpr = buildCheckExpr(PREV_TYPES);

  await knex.raw('ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check');
  await knex.raw('ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_type_check');
  await knex.raw('ALTER TABLE board_notification_type_preferences DROP CONSTRAINT IF EXISTS board_notification_type_preferences_type_check');

  await knex.raw(`ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (${prevExpr})`);
  await knex.raw(`ALTER TABLE notification_preferences ADD CONSTRAINT notification_preferences_type_check CHECK (${prevExpr})`);
  await knex.raw(`ALTER TABLE board_notification_type_preferences ADD CONSTRAINT board_notification_type_preferences_type_check CHECK (${prevExpr})`);
}
