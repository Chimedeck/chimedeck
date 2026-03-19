// db/migrations/0041_migrate_guest_board_members.ts
// Fix-up: users who were added to board_members but hold a workspace GUEST role
// should have been in board_guest_access instead. This migration:
//   1. Inserts missing board_guest_access rows for those users.
//   2. Removes their orphaned board_members rows.
import { randomUUID } from 'crypto';
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Find every board_members row where the user is a workspace GUEST.
  const rows = await knex('board_members as bm')
    .join('boards as b', 'bm.board_id', 'b.id')
    .join('memberships as ms', function () {
      this.on('ms.user_id', '=', 'bm.user_id').andOn('ms.workspace_id', '=', 'b.workspace_id');
    })
    .where('ms.role', 'GUEST')
    .select('bm.board_id', 'bm.user_id', 'bm.created_at');

  if (rows.length === 0) return;

  // Insert board_guest_access rows (idempotent via onConflict ignore).
  const grantRows = rows.map((r: { board_id: string; user_id: string; created_at: string }) => ({
    id: randomUUID(),
    board_id: r.board_id,
    user_id: r.user_id,
    // [why] No original granter recorded — use user_id as placeholder sentinel.
    granted_by: r.user_id,
    granted_at: r.created_at,
  }));

  await knex('board_guest_access').insert(grantRows).onConflict(['user_id', 'board_id']).ignore();

  // Remove the now-migrated board_members rows.
  for (const r of rows as Array<{ board_id: string; user_id: string }>) {
    await knex('board_members').where({ board_id: r.board_id, user_id: r.user_id }).delete();
  }
}

export async function down(knex: Knex): Promise<void> {
  // Down is intentionally a no-op: restoring stale board_members rows would
  // re-introduce the original bug and the original data is gone.
}
