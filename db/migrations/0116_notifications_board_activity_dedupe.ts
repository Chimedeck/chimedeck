import type { Knex } from 'knex';

const DEDUPE_INDEX = 'notifications_board_activity_dedupe_idx';

export async function up(knex: Knex): Promise<void> {
  // [why] Existing duplicate rows would make the unique index creation fail.
  // Keep the newest copy and drop older duplicates for the same board-activity source.
  await knex.raw(`
    DELETE FROM notifications n
    USING (
      SELECT ctid,
             ROW_NUMBER() OVER (
               PARTITION BY user_id, source_type, source_id, type
               ORDER BY created_at DESC, id DESC
             ) AS rn
      FROM notifications
      WHERE source_type = 'board_activity'
        AND source_id IS NOT NULL
    ) d
    WHERE n.ctid = d.ctid
      AND d.rn > 1
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS ${DEDUPE_INDEX}
      ON notifications (user_id, source_type, source_id, type)
      WHERE source_type = 'board_activity'
        AND source_id IS NOT NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS ${DEDUPE_INDEX}`);
}
