// Service logic for user-private card drafts.
// All operations are scoped to userId — callers must never pass an arbitrary userId.
import { db } from '../../../common/db';
import { randomUUID } from 'crypto';

export interface DraftRow {
  id: string;
  user_id: string;
  workspace_id: string;
  board_id: string;
  card_id: string;
  draft_type: 'description' | 'comment';
  content_markdown: string;
  intent: 'editing' | 'save_pending' | 'submit_pending';
  client_updated_at: string;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertDraftParams {
  userId: string;
  cardId: string;
  draftType: 'description' | 'comment';
  contentMarkdown: string;
  intent: 'editing' | 'save_pending' | 'submit_pending';
  clientUpdatedAt: string;
  workspaceId: string;
  boardId: string;
}

// Returns all drafts for the current user on a given card.
export async function getDraftsByCard({
  userId,
  cardId,
}: {
  userId: string;
  cardId: string;
}): Promise<DraftRow[]> {
  return db('user_card_drafts').where({ user_id: userId, card_id: cardId }).select('*');
}

// Upserts (insert or update) a single draft row.
// Unique constraint is (user_id, card_id, draft_type) — safe for concurrent writes.
export async function upsertDraft({
  userId,
  cardId,
  draftType,
  contentMarkdown,
  intent,
  clientUpdatedAt,
  workspaceId,
  boardId,
}: UpsertDraftParams): Promise<DraftRow> {
  const now = new Date().toISOString();

  const existing = await db('user_card_drafts')
    .where({ user_id: userId, card_id: cardId, draft_type: draftType })
    .first<DraftRow>();

  if (existing) {
    await db('user_card_drafts')
      .where({ id: existing.id })
      .update({
        content_markdown: contentMarkdown,
        intent,
        client_updated_at: clientUpdatedAt,
        synced_at: now,
        updated_at: now,
      });
    const updated = await db('user_card_drafts').where({ id: existing.id }).first<DraftRow>();
    return updated!;
  }

  const id = randomUUID();
  await db('user_card_drafts').insert({
    id,
    user_id: userId,
    workspace_id: workspaceId,
    board_id: boardId,
    card_id: cardId,
    draft_type: draftType,
    content_markdown: contentMarkdown,
    intent,
    client_updated_at: clientUpdatedAt,
    synced_at: now,
    created_at: now,
    updated_at: now,
  });

  const inserted = await db('user_card_drafts').where({ id }).first<DraftRow>();
  return inserted!;
}

// Deletes a draft for the current user. Returns true if a row was deleted.
export async function deleteDraft({
  userId,
  cardId,
  draftType,
}: {
  userId: string;
  cardId: string;
  draftType: string;
}): Promise<boolean> {
  const count = await db('user_card_drafts')
    .where({ user_id: userId, card_id: cardId, draft_type: draftType })
    .delete();
  return count > 0;
}
