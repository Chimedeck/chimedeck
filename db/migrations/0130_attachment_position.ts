// Adds a nullable position column to the attachments table for drag-and-drop reorder.
// Uses the same fractional-indexing approach as checklists and lists.
import type { Knex } from 'knex';
import { generatePositions } from '../../server/extensions/list/mods/fractional';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('attachments', (table) => {
    table.string('position').nullable();
  });

  // Populate existing rows with positions that REPRODUCE the current UI order.
  // [why not created_at asc] The attachment list endpoint (both before and after this
  // migration) orders by created_at DESC (newest first). Assigning positions in
  // ascending created_at order would visibly flip every card's attachment order on
  // deploy. Iterating created_at DESC and handing out well-spaced lexicographic
  // positions from the shared fractional-index module keeps the exact current order.
  // Strings (not numeric strings) avoid the lexicographic pitfall where
  // "1000" sorts before "2000" but "20000" before "3000".
  const attachments = await knex('attachments')
    .select('id', 'card_id', 'created_at')
    .orderBy('created_at', 'desc');

  // Group by card_id and assign positions within each card
  const cardGroups = new Map<string, Array<{ id: string; created_at: string }>>();
  for (const row of attachments) {
    const group = cardGroups.get(row.card_id) || [];
    group.push(row);
    cardGroups.set(row.card_id, group);
  }

  for (const [, group] of cardGroups) {
    const positions = generatePositions(group.length);
    for (let i = 0; i < group.length; i++) {
      await knex('attachments')
        .where({ id: group[i]!.id })
        .update({ position: positions[i]! });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('attachments', (table) => {
    table.dropColumn('position');
  });
}