// db/migrations/0133_notification_reminder_email.ts
// Adds reminder_email_sent_at column + partial index for unread notification email reminders (Sprint 181).
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('notifications', (table) => {
    // [why] Tracks whether a reminder email has already been sent for this notification.
    // NULL means never reminded — all existing notifications are eligible.
    table.timestamp('reminder_email_sent_at', { useTz: true }).nullable();
  });

  // [why] Partial index covers the scheduler's hot query: find unread notifications
  // that haven't been reminded yet, grouped by user. The WHERE clause keeps the
  // index small — only unread + unreminded rows are indexed.
  await knex.raw(
    'CREATE INDEX notifications_unread_unreminded_idx ON notifications (user_id, created_at DESC) WHERE read = false AND reminder_email_sent_at IS NULL',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS notifications_unread_unreminded_idx');

  await knex.schema.alterTable('notifications', (table) => {
    table.dropColumn('reminder_email_sent_at');
  });
}
