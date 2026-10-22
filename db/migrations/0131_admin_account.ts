import type { Knex } from 'knex';

/**
 * Add platform-level admin columns to the users table.
 *
 * [why] The platform admin dashboard (Sprints 177-179) requires a DB-level
 * admin flag and account status for user management. These are orthogonal to
 * workspace roles — a platform admin can manage any user regardless of
 * workspace membership.
 *
 * Columns:
 *   is_admin          — platform-level admin flag (deny-first: defaults to false)
 *   account_status    — 'active' | 'paused' | 'banned' (CHECK constraint enforced)
 *   status_changed_by — FK to users.id for audit trail (SET NULL on user deletion)
 *   status_changed_at — timestamp of last status change
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    // [why] Deny-first: all existing users default to non-admin.
    table.boolean('is_admin').notNullable().defaultTo(false);
    // [why] All existing users are active; new users start active.
    table.string('account_status').notNullable().defaultTo('active');
    // [why] Audit trail — who changed the status. SET NULL so the trail
    // survives deletion of the admin who performed the action.
    table.string('status_changed_by').nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('status_changed_at').nullable();
  });

  // [why] Enforce valid status values at the DB level so application bugs
  // cannot insert invalid states.
  await knex.raw(
    `ALTER TABLE users ADD CONSTRAINT users_account_status_check CHECK (account_status IN ('active', 'paused', 'banned'))`
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_status_check');

  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('status_changed_at');
    table.dropColumn('status_changed_by');
    table.dropColumn('account_status');
    table.dropColumn('is_admin');
  });
}
