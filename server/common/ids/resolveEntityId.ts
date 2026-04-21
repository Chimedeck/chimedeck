import { db } from '../db';

async function resolveEntityId(
  tableName: 'boards' | 'cards' | 'lists' | 'comments' | 'attachments',
  identifier: string,
): Promise<string | null> {
  const row = await db(tableName)
    .where('id', identifier)
    .orWhere('short_id', identifier)
    .select('id')
    .first();

  return (row?.id as string | undefined) ?? null;
}

export async function resolveBoardId(identifier: string): Promise<string | null> {
  return resolveEntityId('boards', identifier);
}

export async function resolveCardId(identifier: string): Promise<string | null> {
  return resolveEntityId('cards', identifier);
}

export async function resolveListId(identifier: string): Promise<string | null> {
  return resolveEntityId('lists', identifier);
}

export async function resolveCommentId(identifier: string): Promise<string | null> {
  return resolveEntityId('comments', identifier);
}

export async function resolveAttachmentId(identifier: string): Promise<string | null> {
  return resolveEntityId('attachments', identifier);
}
