import { db } from '../db';

export interface CardCoverFields {
  id: string;
  cover_attachment_id?: string | null;
}

export interface CardWithResolvedCover extends CardCoverFields {
  cover_image_url: string | null;
  cover_aspect_ratio: '16:9' | '1:1' | null;
  cover_is_gif: boolean;
}

interface AttachmentCoverRow {
  id: string;
  card_id: string;
  status: string;
  s3_key: string | null;
  thumbnail_key: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
}

export async function resolveCoverImageUrls<T extends CardCoverFields>(cards: T[]): Promise<Array<T & CardWithResolvedCover>> {
  if (cards.length === 0) return [];

  const coverAttachmentIds = [...new Set(
    cards
      .map((card) => card.cover_attachment_id)
      .filter((id): id is string => Boolean(id)),
  )];

  if (coverAttachmentIds.length === 0) {
    return cards.map((card) => ({ ...card, cover_image_url: null, cover_aspect_ratio: null, cover_is_gif: false }));
  }

  const attachmentRows = await db('attachments')
    .whereIn('id', coverAttachmentIds)
    .select('id', 'card_id', 'status', 's3_key', 'thumbnail_key', 'mime_type', 'width', 'height') as AttachmentCoverRow[];

  const attachmentById = new Map(attachmentRows.map((row) => [row.id, row]));

  const cardsWithCover = cards.map((card) => {
      const attachmentId = card.cover_attachment_id;
      if (!attachmentId) return { ...card, cover_image_url: null, cover_aspect_ratio: null, cover_is_gif: false };

      const attachment = attachmentById.get(attachmentId);
      if (attachment?.card_id !== card.id || attachment?.status !== 'READY') {
        return { ...card, cover_image_url: null, cover_aspect_ratio: null, cover_is_gif: false };
      }

      const hasKey = attachment.s3_key ?? attachment.thumbnail_key;
      if (!hasKey) return { ...card, cover_image_url: null, cover_aspect_ratio: null, cover_is_gif: false };

      // [why] Never expose presigned S3 URLs — use the authenticated proxy endpoint instead.
      // GIFs must use /view to preserve animation; WebP thumbnail would strip it.
      const isGif = attachment.mime_type === 'image/gif';
      const proxyUrl = (!isGif && attachment.thumbnail_key)
        ? `/api/v1/attachments/${attachment.id}/thumbnail`
        : `/api/v1/attachments/${attachment.id}/view`;

      // [why] width/height >= 1.5 → landscape image → 16:9; otherwise portrait/square → 1:1
      const { width, height } = attachment;
      const coverAspectRatio: '16:9' | '1:1' | null =
        (width && height) ? (width / height >= 1.5 ? '16:9' : '1:1') : null;

      return {
        ...card,
        cover_image_url: proxyUrl,
        cover_aspect_ratio: coverAspectRatio,
        cover_is_gif: isGif,
      };
    });

  return cardsWithCover;
}

export async function resolveCoverImageUrl<T extends CardCoverFields>(card: T): Promise<T & CardWithResolvedCover> {
  const [resolved] = await resolveCoverImageUrls([card]);
  return resolved ?? { ...card, cover_image_url: null, cover_aspect_ratio: null, cover_is_gif: false };
}
