// db/migrations/0119_board_chat_permissions.ts
// Sprint 165 — per-board chat permission settings for guest access.
// org_member_can_view/use are fixed=true and not stored; only guest toggles are persisted.
// Missing row means safe defaults: guest_can_view=false, guest_can_use=false.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('board_chat_permissions', (table) => {
    table.string('id').primary();
    table.string('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
    table.boolean('guest_can_view').notNullable().defaultTo(false);
    table.boolean('guest_can_use').notNullable().defaultTo(false);
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['board_id']);
    table.index(['board_id']);
  });

  // Backfill one row per existing board so the first GET is deterministic.
  const boards = await knex('boards').select('id');
  if (boards.length > 0) {
    await knex('board_chat_permissions').insert(
      boards.map((b: { id: string }) => ({
        id: b.id + '-chat-perm',
        board_id: b.id,
        guest_can_view: false,
        guest_can_use: false,
      })),
    );
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('board_chat_permissions');
}
