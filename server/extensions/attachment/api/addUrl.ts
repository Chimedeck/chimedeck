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
import { dispatchEvent } from '../../../mods/events/dispatch';
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

// Detects internal card URLs of the form /boards/:boardId?card=:cardId.
// Returns the cardId if matched; otherwise null.
// We only extract the card query-param so the check works for any domain/port.
export function parseInternalCardUrl(rawUrl: string): { cardId: string } | null {
  try {
    const parsed = new URL(rawUrl);
    const pathMatch = parsed.pathname.match(/^\/boards\/([^/]+)$/);
    if (!pathMatch) return null;
    const cardId = parsed.searchParams.get('card');
    if (!cardId) return null;
    return { cardId };
  } catch {
    return null;
  }
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

  // Try to detect an internal card URL first (bypasses SSRF check — validated via DB instead).
  const internalCard = parseInternalCardUrl(body.url);
  let referencedCardId: string | null = null;

  if (internalCard) {
    const referencedCard = await db('cards').where({ id: internalCard.cardId }).first();
    if (!referencedCard) {
      return Response.json(
        { name: 'referenced-card-not-found', data: { message: 'The linked card was not found' } },
        { status: 404 },
      );
    }
    // Validate the referenced card is in the same workspace to prevent cross-workspace links.
    const refList = await db('lists').where({ id: referencedCard.list_id }).first();
    const refBoard = refList ? await db('boards').where({ id: refList.board_id }).first() : null;
    if (!refBoard || refBoard.workspace_id !== board.workspace_id) {
      return Response.json(
        { name: 'referenced-card-not-in-workspace', data: { message: 'The linked card is not in the same workspace' } },
        { status: 400 },
      );
    }
    referencedCardId = referencedCard.id;
  } else if (isForbiddenUrl(body.url)) {
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
    referenced_card_id: referencedCardId,
    created_at: new Date().toISOString(),
  });

  const attachment = await db('attachments').where({ id: attachmentId }).first();

  const activityAction = referencedCardId ? 'card_link_attached' : 'attachment_added';

  await dispatchEvent({
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
    action: activityAction,
    actorId,
    payload: {
      attachmentId,
      cardId,
      name: body.name,
      cardTitle: card.title,
      ...(referencedCardId ? { referencedCardId } : {}),
    },
  });

  publisher
    .publish(board.id, JSON.stringify({ type: 'attachment_added', entity_id: cardId, payload: { attachmentId } }))
    .catch(() => {});

  return Response.json({ data: attachment }, { status: 201 });
}
