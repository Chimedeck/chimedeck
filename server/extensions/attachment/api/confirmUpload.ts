// POST /api/v1/cards/:id/attachments
// Confirms an upload: verifies S3 object exists, enqueues virus scan, publishes WS event.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireMemberOrBoardGuestMember,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { headObject } from '../mods/s3/headObject';
import { enqueueScan } from '../mods/virusScan/enqueue';
import { publisher } from '../../../mods/pubsub/publisher';
import { writeEvent } from '../../../mods/events/write';
import { writeActivity } from '../../activity/mods/write';

export async function handleConfirmUpload(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const card = await db('cards').where({ id: cardId }).first();
  if (!card) {
    return Response.json({ error: { code: 'card-not-found', message: 'Card not found' } }, { status: 404 });
  }

  const list = await db('lists').where({ id: card.list_id }).first();
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;
  if (!board) {
    return Response.json({ error: { code: 'board-not-found', message: 'Board not found' } }, { status: 404 });
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;
  const roleError = await requireMemberOrBoardGuestMember(scopedReq, board.id);
  if (roleError) return roleError;

  let body: { attachmentId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: { code: 'bad-request', message: 'Invalid JSON body' } }, { status: 400 });
  }

  if (!body.attachmentId) {
    return Response.json({ error: { code: 'bad-request', message: 'attachmentId is required' } }, { status: 400 });
  }

  const attachment = await db('attachments')
    .where({ id: body.attachmentId, card_id: cardId, type: 'FILE' })
    .first();

  if (!attachment) {
    return Response.json(
      { error: { code: 'attachment-not-found', message: 'Attachment not found' } },
      { status: 404 },
    );
  }

  // Verify the client actually PUT the file to S3
  if (!attachment.s3_key) {
    return Response.json(
      { error: { code: 'upload-url-expired', message: 'Upload was not completed' } },
      { status: 400 },
    );
  }

  const exists = await headObject({ s3Key: attachment.s3_key }).catch(() => false);
  if (!exists) {
    return Response.json(
      { error: { code: 'upload-url-expired', message: 'S3 object not found — upload may not have completed' } },
      { status: 400 },
    );
  }

  const actorId = (req as AuthenticatedRequest).currentUser!.id;

  // Enqueue virus scan (no-op when VIRUS_SCAN_ENABLED=false)
  await enqueueScan({ attachmentId: attachment.id });

  await writeEvent({
    type: 'attachment_added',
    boardId: board.id,
    entityId: cardId,
    actorId,
    payload: { attachmentId: attachment.id, cardId, name: attachment.name },
  });

  await writeActivity({
    entityType: 'card',
    entityId: cardId,
    boardId: board.id,
    action: 'attachment_added',
    actorId,
    payload: { attachmentId: attachment.id, cardId, name: attachment.name },
  });

  publisher
    .publish(
      board.id,
      JSON.stringify({ type: 'attachment_added', entity_id: cardId, payload: { attachmentId: attachment.id } }),
    )
    .catch(() => {});

  const updated = await db('attachments').where({ id: attachment.id }).first();
  return Response.json({ data: updated }, { status: 200 });
}
