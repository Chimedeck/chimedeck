// db/migrations/0085_guest_role_type.ts
// Sprint 89 — splits the GUEST concept into two sub-types scoped to a board.
// VIEWER = read-only (preserves original GUEST behaviour)
// MEMBER = full write access within the board scope only
// Non-destructive: all existing rows default to VIEWER.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('board_guest_access', (table) => {
    table
      .enu('guest_type', ['VIEWER', 'MEMBER'])
      .notNullable()
      .defaultTo('VIEWER'); // all existing guests become read-only
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('board_guest_access', (table) => {
    table.dropColumn('guest_type');
  });
}
