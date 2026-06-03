import { randomUUID } from 'node:crypto';
import { db } from '../../../common/db';
import { between, HIGH_SENTINEL } from '../../list/mods/fractional';
import { sanitizeText, sanitizeRichText } from '../../../common/sanitize';
import { resolveCoverImageUrl, type CardWithResolvedCover } from '../../../common/cards/cover';
import { generateUniqueShortId } from '../../../common/ids/shortId';

export interface CreateCardInput {
  listId: string;
  title: string;
  description?: string | null;
  startDate?: string | null;
}

interface CreatedCardRecord {
  id: string;
  list_id: string;
  title: string;
  description: string | null;
  position: string;
  archived: boolean;
  start_date: string | null;
  cover_attachment_id: string | null;
}

export async function createCard({
  listId,
  title,
  description,
  startDate,
}: CreateCardInput): Promise<CreatedCardRecord & CardWithResolvedCover> {
  const lastCard = await db('cards')
    .where({ list_id: listId, archived: false })
    .orderBy('position', 'desc')
    .first();

  const position = between(lastCard ? lastCard.position : '', HIGH_SENTINEL);

  const id = randomUUID();
  const shortId = await generateUniqueShortId('cards');
  await db('cards').insert({
    id,
    short_id: shortId,
    list_id: listId,
    title: sanitizeText(title.trim()),
    description: description ? sanitizeRichText(description.trim()) : null,
    position,
    archived: false,
    start_date: startDate ?? null,
  });

  const card = await db('cards').where({ id }).first();
  return resolveCoverImageUrl(card as CreatedCardRecord);
}
