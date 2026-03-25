// POST /api/v1/cards/:id/attachments/url
// Adds an external URL attachment; performs SSRF validation before persisting.
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireMemberOrBoardGuestMember,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { publisher } from '../../../mods/pubsub/publisher';
import { writeEvent } from '../../../mods/events/write';
import { writeActivity } from '../../activity/mods/write';

// Private/internal IP ranges that must not be targeted (SSRF prevention).
const FORBIDDEN_RANGES = [
  /^127\./,                                       // 127.0.0.0/8  loopback
  /^10\./,                                        // 10.0.0.0/8   private
  /^172\.(1[6-9]|2\d|3[01])\./,                  // 172.16.0.0/12 private
  /^192\.168\./,                                  // 192.168.0.0/16 private
  /^169\.254\./,                                  // 169.254.0.0/16 link-local
  /^::1$/,                                        // IPv6 loopback (without brackets)
  /^\[::1\]$/,                                    // IPv6 loopback (with brackets, as parsed by URL)
  /^fc00:/i,                                      // IPv6 unique local
  /^fe80:/i,                                      // IPv6 link-local
  /^0\.0\.0\.0$/,                                 // unspecified
];

export function isForbiddenUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return true; // malformed URLs are rejected
  }

  const hostname = parsed.hostname;
  return FORBIDDEN_RANGES.some((re) => re.test(hostname));
}

export async function handleAddUrl(req: Request, cardId: string): Promise<Response> {
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

  let body: { name?: string; url?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: { code: 'bad-request', message: 'Invalid JSON body' } }, { status: 400 });
  }

  if (!body.name || !body.url) {
    return Response.json(
      { error: { code: 'bad-request', message: 'name and url are required' } },
      { status: 400 },
    );
  }

  if (isForbiddenUrl(body.url)) {
    return Response.json(
      { error: { code: 'url-target-forbidden', message: 'URL resolves to a forbidden internal address' } },
      { status: 400 },
    );
  }

  const actorId = (req as AuthenticatedRequest).currentUser!.id;
  const attachmentId = randomUUID();

  await db('attachments').insert({
    id: attachmentId,
    card_id: cardId,
    uploaded_by: actorId,
    name: body.name,
    type: 'URL',
    url: body.url,
    status: 'READY',
    created_at: new Date().toISOString(),
  });

  const attachment = await db('attachments').where({ id: attachmentId }).first();

  await writeEvent({
    type: 'attachment_added',
    boardId: board.id,
    entityId: cardId,
    actorId,
    payload: { attachmentId, cardId, name: body.name },
  });

  await writeActivity({
    entityType: 'card',
    entityId: cardId,
    boardId: board.id,
    action: 'attachment_added',
    actorId,
    payload: { attachmentId, cardId, name: body.name, cardTitle: card.title },
  });

  publisher
    .publish(board.id, JSON.stringify({ type: 'attachment_added', entity_id: cardId, payload: { attachmentId } }))
    .catch(() => {});

  return Response.json({ data: attachment }, { status: 201 });
}
