import type { Knex } from 'knex';

/**
 * Sprint 171 — add IDLE to card_chat_sessions status CHECK constraint.
 *
 * The original 0121 migration defined the status enum as
 * ['ACTIVE_REFINEMENT', 'PAUSED', 'READY_FOR_REVIEW'], omitting IDLE.
 *
 * This migration adds IDLE to the constraint. Existing rows are unaffected —
 * they remain in their current state.
 *
 * [why] We use raw SQL for the constraint modification because Knex's
 * checkIn/alter cannot add values to an existing CHECK constraint. The
 * approach drops and recreates the constraint with the expanded value set.
 */
export async function up(knex: Knex): Promise<void> {
  // Drop existing CHECK constraint and recreate with IDLE included.
  // PostgreSQL doesn't support altering CHECK constraints directly —
  // the safe approach is drop + recreate.
  await knex.raw(`
    ALTER TABLE card_chat_sessions
      DROP CONSTRAINT IF EXISTS card_chat_sessions_status_check;
  `);

  await knex.raw(`
    ALTER TABLE card_chat_sessions
      ADD CONSTRAINT card_chat_sessions_status_check
      CHECK (status IN ('IDLE', 'ACTIVE_REFINEMENT', 'PAUSED', 'READY_FOR_REVIEW'));
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Revert to the original constraint without IDLE.
  // [why] If any rows already have status = 'IDLE' at rollback time,
  // this will fail — the only safe path is to not roll back schema
  // expansions like this in production. The down migration exists for
  // local dev reset scenarios.
  await knex.raw(`
    ALTER TABLE card_chat_sessions
      DROP CONSTRAINT IF EXISTS card_chat_sessions_status_check;
  `);

  await knex.raw(`
    ALTER TABLE card_chat_sessions
      ADD CONSTRAINT card_chat_sessions_status_check
      CHECK (status IN ('ACTIVE_REFINEMENT', 'PAUSED', 'READY_FOR_REVIEW'));
  `);
}
