// Syncs the mentions table for a given source (card_description or comment).
// Diffs old vs new mentions and returns newly added user IDs (for notification dispatch).
import { db } from '../db';
import { extractMentions } from './parse';
import { resolveNicknames } from './resolve';
import type { Knex } from 'knex';

interface SyncResult {
  addedUserIds: string[];
}

export async function syncMentions({
  trx,
  sourceType,
  sourceId,
  text,
  boardId,
  mentionedByUserId,
}: {
  trx: Knex.Transaction;
  sourceType: 'card_description' | 'comment';
  sourceId: string;
  text: string;
  boardId: string;
  mentionedByUserId: string;
}): Promise<SyncResult> {
  // Fetch existing mentioned user IDs before overwrite
  const existing = await trx('mentions')
    .where({ source_type: sourceType, source_id: sourceId })
    .pluck('mentioned_user_id') as string[];

  const nicknames = extractMentions({ text });
  const resolvedUsers = await resolveNicknames({ nicknames, boardId });
  const newUserIds = resolvedUsers.map((u) => u.id);

  // Re-derive — delete all and re-insert
  await trx('mentions').where({ source_type: sourceType, source_id: sourceId }).delete();

  if (newUserIds.length > 0) {
    await trx('mentions').insert(
      newUserIds.map((userId) => ({
        source_type: sourceType,
        source_id: sourceId,
        mentioned_user_id: userId,
        mentioned_by_user_id: mentionedByUserId,
        created_at: new Date().toISOString(),
      })),
    );
  }

  const existingSet = new Set(existing);
  const addedUserIds = newUserIds.filter((id) => !existingSet.has(id));

  return { addedUserIds };
}
