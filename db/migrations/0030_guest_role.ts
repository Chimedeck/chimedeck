// db/migrations/0030_guest_role.ts
// Sprint 49 — adds GUEST to membership role enum and creates board_guest_access join table.
// GUESTs are scoped to specific boards rather than the entire workspace.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Extend the memberships.role CHECK constraint to include GUEST.
  // Knex on PostgreSQL uses a CHECK constraint (not a native enum type),
  // so we drop the old constraint and add the new one.
  await knex.raw(`
    ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
    ALTER TABLE memberships ADD CONSTRAINT memberships_role_check
      CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'GUEST'));
  `);

  // board_guest_access: grants a GUEST user read access to a specific board.
  await knex.schema.createTable('board_guest_access', (table) => {
    table.string('id').primary();
    table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
    table.string('granted_by').notNullable().references('id').inTable('users');
    table.timestamp('granted_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['user_id', 'board_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('board_guest_access');

  // Restore the original CHECK constraint without GUEST.
  await knex.raw(`
    ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
    ALTER TABLE memberships ADD CONSTRAINT memberships_role_check
      CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER'));
  `);
}
