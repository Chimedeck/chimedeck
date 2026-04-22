import type { Knex } from 'knex';

// [why] Board hydration relies on list-scoped card scans, label/member joins,
// and card-related count queries. These indexes target the exact predicates and
// join keys used in GET /api/v1/boards/:id.
export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE INDEX IF NOT EXISTS cards_list_archived_position_idx ON cards (list_id, archived, position)');
  await knex.raw('CREATE INDEX IF NOT EXISTS card_labels_card_id_idx ON card_labels (card_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS card_members_card_id_idx ON card_members (card_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS checklists_card_id_idx ON checklists (card_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS checklist_items_checklist_id_idx ON checklist_items (checklist_id)');

  await knex.raw('CREATE INDEX IF NOT EXISTS comments_card_id_not_deleted_idx ON comments (card_id) WHERE deleted = false');
  await knex.raw('CREATE INDEX IF NOT EXISTS attachments_card_id_ready_idx ON attachments (card_id) WHERE status = \'READY\'');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS attachments_card_id_ready_idx');
  await knex.raw('DROP INDEX IF EXISTS comments_card_id_not_deleted_idx');
  await knex.raw('DROP INDEX IF EXISTS checklist_items_checklist_id_idx');
  await knex.raw('DROP INDEX IF EXISTS checklists_card_id_idx');
  await knex.raw('DROP INDEX IF EXISTS card_members_card_id_idx');
  await knex.raw('DROP INDEX IF EXISTS card_labels_card_id_idx');
  await knex.raw('DROP INDEX IF EXISTS cards_list_archived_position_idx');
}
