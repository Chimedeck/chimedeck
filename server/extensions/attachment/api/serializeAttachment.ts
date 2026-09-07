export type AttachmentRow = {
  id: string; card_id: string; name: string; alias: string | null; type: 'FILE' | 'URL';
  url: string | null; external_url: string | null; mime_type: string | null; size_bytes: number | null;
  status: string; thumbnail_key: string | null; width: number | null; height: number | null;
  created_at: string; updated_at: string; referenced_card_id: string | null;
};

export type ReferencedCard = {
  id: string; title: string; board_id: string | null; board_name: string | null;
  list_id: string | null; list_name: string | null;
  labels: Array<{ id: string; name: string; color: string }>;
};

export function serializeAttachment(
  attachment: AttachmentRow,
  refCardMap: Record<string, ReferencedCard>,
) {
  const view_url = attachment.type === 'URL'
    ? (attachment.url ?? attachment.external_url ?? null)
    : `/api/v1/attachments/${attachment.id}/view`;
  const thumbnail_url = attachment.thumbnail_key
    ? `/api/v1/attachments/${attachment.id}/thumbnail`
    : null;

  return {
    id: attachment.id, card_id: attachment.card_id, name: attachment.name, alias: attachment.alias ?? null,
    type: attachment.type, content_type: attachment.mime_type ?? null, size_bytes: attachment.size_bytes ?? null,
    status: attachment.status, view_url, thumbnail_url, external_url: attachment.external_url ?? null,
    width: attachment.width ?? null, height: attachment.height ?? null, created_at: attachment.created_at,
    updated_at: attachment.updated_at, referenced_card_id: attachment.referenced_card_id ?? null,
    referenced_card: attachment.referenced_card_id ? (refCardMap[attachment.referenced_card_id] ?? null) : null,
  };
}
