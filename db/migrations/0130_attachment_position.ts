// Adds a nullable position column to the attachments table for drag-and-drop reorder.
// Uses the same fractional-indexing approach as checklists and lists.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('attachments', (table) => {
    table.string('position').nullable();
  });

  // Populate existing rows with a default position based on created_at order
  // so the initial sort matches the current newest-first behavior.
  const attachments = await knex('attachments')
    .select('id', 'card_id', 'created_at')
    .orderBy('created_at', 'asc');

  // Group by card_id and assign positions within each card
  const cardGroups = new Map<string, Array<{ id: string; created_at: string }>>();
  for (const row of attachments) {
    const group = cardGroups.get(row.card_id) || [];
    group.push(row);
    cardGroups.set(row.card_id, group);
  }

  for (const [, group] of cardGroups) {
    for (let i = 0; i < group.length; i++) {
      // Simple numeric positions — the reorder endpoint will use fractional indexing
      // for new positions, but existing rows just need a stable sort order.
      await knex('attachments')
        .where({ id: group[i]!.id })
        .update({ position: String(i * 1000) });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('attachments', (table) => {
    table.dropColumn('position');
  });
}
