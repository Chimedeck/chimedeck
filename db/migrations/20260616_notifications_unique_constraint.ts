// db/migrations/20260616_notifications_unique_constraint.ts
// Adds a unique constraint on (user_id, type, source_type, source_id) to prevent
// duplicate notification rows. This is a defense-in-depth measure — notification
// insert paths already try to avoid duplicates at the application level, but
// race conditions (e.g. concurrent event processing, WebSocket re-delivery)
// can still produce duplicates without a database-level guard.
//
// The constraint uses NULLS NOT DISTINCT so rows with NULL values in any of the
// constrained columns are still considered duplicates of each other.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // [why] Clean up any existing duplicates before adding the constraint.
  // Keep the row with the earliest created_at (first insertion).
  await knex.raw(`
    DELETE FROM notifications
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
          ROW_NUMBER() OVER (
            PARTITION BY user_id, type, source_type, source_id
            ORDER BY created_at ASC
          ) AS rn
        FROM notifications
      ) sub
      WHERE sub.rn > 1
    )
  `);

  await knex.raw(`
    ALTER TABLE notifications
    ADD CONSTRAINT notifications_user_type_source_unique
    UNIQUE NULLS NOT DISTINCT (user_id, type, source_type, source_id)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE notifications
    DROP CONSTRAINT IF EXISTS notifications_user_type_source_unique
  `);
}
