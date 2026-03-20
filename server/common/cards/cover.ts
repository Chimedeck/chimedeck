import { db } from '../db';
import { presignGetUrl } from '../../extensions/attachment/common/presign';

export interface CardCoverFields {
  id: string;
  cover_attachment_id?: string | null;
}

export interface CardWithResolvedCover extends CardCoverFields {
  cover_image_url: string | null;
}

interface AttachmentCoverRow {
  id: string;
  card_id: string;
  status: string;
  s3_key: string | null;
  thumbnail_key: string | null;
}

export async function resolveCoverImageUrls<T extends CardCoverFields>(cards: T[]): Promise<Array<T & CardWithResolvedCover>> {
  if (cards.length === 0) return [];

  const coverAttachmentIds = [...new Set(
    cards
      .map((card) => card.cover_attachment_id)
      .filter((id): id is string => Boolean(id)),
  )];

  if (coverAttachmentIds.length === 0) {
    return cards.map((card) => ({ ...card, cover_image_url: null }));
  }

  const attachmentRows = await db('attachments')
    .whereIn('id', coverAttachmentIds)
    .select('id', 'card_id', 'status', 's3_key', 'thumbnail_key') as AttachmentCoverRow[];

  const attachmentById = new Map(attachmentRows.map((row) => [row.id, row]));

  const cardsWithCover = await Promise.all(
    cards.map(async (card) => {
      const attachmentId = card.cover_attachment_id;
      if (!attachmentId) return { ...card, cover_image_url: null };

      const attachment = attachmentById.get(attachmentId);
      if (attachment?.card_id !== card.id || attachment?.status !== 'READY') {
        return { ...card, cover_image_url: null };
      }

      const objectKey = attachment.s3_key ?? attachment.thumbnail_key;
      if (!objectKey) return { ...card, cover_image_url: null };

      try {
        const { url } = await presignGetUrl({ s3Key: objectKey });
        return { ...card, cover_image_url: url };
      } catch {
        return { ...card, cover_image_url: null };
      }
    }),
  );

  return cardsWithCover;
}

export async function resolveCoverImageUrl<T extends CardCoverFields>(card: T): Promise<T & CardWithResolvedCover> {
  const [resolved] = await resolveCoverImageUrls([card]);
  return resolved ?? { ...card, cover_image_url: null };
}
