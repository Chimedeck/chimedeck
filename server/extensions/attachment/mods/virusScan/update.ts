// Updates attachment scan status (READY | REJECTED) and publishes a WS event.
// Triggers thumbnail generation as a fire-and-forget side-effect when status → READY.
import { db } from '../../../../common/db';
import { publisher } from '../../../../mods/pubsub/publisher';
import { writeEvent } from '../../../../mods/events/write';
import { generateThumbnail } from '../../workers/thumbnail';

export async function updateScanResult({
  attachmentId,
  status,
}: {
  attachmentId: string;
  status: 'READY' | 'REJECTED';
}): Promise<void> {
  const attachment = await db('attachments').where({ id: attachmentId }).first();
  if (!attachment) return;

  await db('attachments').where({ id: attachmentId }).update({ status });

  // Fire-and-forget thumbnail generation when an image passes the virus scan
  if (status === 'READY') {
    generateThumbnail({ attachmentId }).catch((err) =>
      console.error(`[thumbnail] failed for ${attachmentId}:`, err),
    );
  }

  const card = await db('cards').where({ id: attachment.card_id }).first();
  const list = card ? await db('lists').where({ id: card.list_id }).first() : null;
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;
  if (!board) return;

  await writeEvent({
    type: 'attachment_updated',
    boardId: board.id,
    entityId: attachment.card_id,
    actorId: attachment.uploaded_by,
    payload: { attachmentId, status },
  });

  publisher
    .publish(
      board.id,
      JSON.stringify({ type: 'attachment_updated', entity_id: attachment.card_id, payload: { attachmentId, status } }),
    )
    .catch(() => {});
}
