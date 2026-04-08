// [why] Labels were previously scoped to a workspace, allowing them to be shared
// across all boards in a workspace. This migration makes labels board-specific —
// each label belongs to exactly one board and cannot be shared between boards.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // [why] A workspace-label to board-label mapping is ambiguous when a label was
  // used across multiple boards. Clean break is the only safe option for migration.
  await knex('card_labels').delete();
  await knex('labels').delete();

  await knex.schema.table('labels', (table) => {
    table.string('board_id').notNullable()
      .references('id').inTable('boards').onDelete('CASCADE');
  });

  await knex.schema.table('labels', (table) => {
    table.dropColumn('workspace_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex('card_labels').delete();
  await knex('labels').delete();

  await knex.schema.table('labels', (table) => {
    table.string('workspace_id').notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
  });

  await knex.schema.table('labels', (table) => {
    table.dropColumn('board_id');
  });
}
