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
import { resolveCardId } from '../../../common/ids/resolveEntityId';
import { generateUniqueShortId } from '../../../common/ids/shortId';

// Private/internal IP ranges that must not be targeted (SSRF prevention).
const FORBIDDEN_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^\[::1\]$/,
  /^fc00:/i,
  /^fe80:/i,
  /^0\.0\.0\.0$/,
];

interface AddUrlBody {
  name?: string;
  url?: string;
}

export function isForbiddenUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return true;
  }

  return FORBIDDEN_RANGES.some((re) => re.test(parsed.hostname));
}

// Detects internal card URLs of the form /c/:cardId[/slug].
export function parseInternalCardUrl(rawUrl: string): { cardId: string } | null {
  try {
    const parsed = new URL(rawUrl);
    const re = /^\/c\/([A-Za-z0-9]+)(?:\/[^/]+)?$/;
    const match = re.exec(parsed.pathname);
    if (!match) return null;
    return { cardId: match[1] as string };
  } catch {
    return null;
  }
}

async function resolveTargetCard(cardId: string) {
  const resolvedCardId = await resolveCardId(cardId);
  if (!resolvedCardId) return null;

  const card = await db('cards').where({ id: resolvedCardId }).first();
  if (!card) return null;

  const list = await db('lists').where({ id: card.list_id }).first();
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;
  if (!board) return null;

  return { resolvedCardId, card, board };
}

async function resolveReferencedCardId(rawUrl: string, workspaceId: string): Promise<string | null> {
  const internalCard = parseInternalCardUrl(rawUrl);
  if (!internalCard) return null;

  const resolvedReferencedCardId = await resolveCardId(internalCard.cardId);
  const referencedCard = resolvedReferencedCardId
    ? await db('cards').where({ id: resolvedReferencedCardId }).first()
    : null;

  if (!referencedCard) {
    throw new Response(
      JSON.stringify({ name: 'referenced-card-not-found', data: { message: 'The linked card was not found' } }),
      { status: 404, headers: { 'content-type': 'application/json' } },
    );
  }

  const refList = await db('lists').where({ id: referencedCard.list_id }).first();
  const refBoard = refList ? await db('boards').where({ id: refList.board_id }).first() : null;
  if (refBoard?.workspace_id !== workspaceId) {
    throw new Response(
      JSON.stringify({
        name: 'referenced-card-not-in-workspace',
        data: { message: 'The linked card is not in the same workspace' },
      }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  return referencedCard.id as string;
}

export async function handleAddUrl(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const target = await resolveTargetCard(cardId);
  if (!target) {
    return Response.json({ error: { code: 'card-not-found', message: 'Card not found' } }, { status: 404 });
  }

  const { resolvedCardId, card, board } = target;
  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = await requireMemberOrBoardGuestMember(scopedReq, board.id);
  if (roleError) return roleError;

  let body: AddUrlBody;
  try {
    body = (await req.json()) as AddUrlBody;
  } catch {
    return Response.json({ error: { code: 'bad-request', message: 'Invalid JSON body' } }, { status: 400 });
  }

  if (!body.name || !body.url) {
    return Response.json(
      { error: { code: 'bad-request', message: 'name and url are required' } },
      { status: 400 },
    );
  }

  if (!parseInternalCardUrl(body.url) && isForbiddenUrl(body.url)) {
    return Response.json(
      { error: { code: 'url-target-forbidden', message: 'URL resolves to a forbidden internal address' } },
      { status: 400 },
    );
  }

  let referencedCardId: string | null = null;
  try {
    referencedCardId = await resolveReferencedCardId(body.url, board.workspace_id);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const actorId = (req as AuthenticatedRequest).currentUser!.id;
  const attachmentId = randomUUID();
  const shortId = await generateUniqueShortId('attachments');

  await db('attachments').insert({
    id: attachmentId,
    short_id: shortId,
    card_id: resolvedCardId,
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
    entityId: resolvedCardId,
    actorId,
    payload: { attachmentId, cardId: resolvedCardId, name: body.name },
  });

  await writeActivity({
    entityType: 'card',
    entityId: resolvedCardId,
    boardId: board.id,
    action: activityAction,
    actorId,
    payload: {
      attachmentId,
      cardId: resolvedCardId,
      name: body.name,
      cardTitle: card.title,
      ...(referencedCardId ? { referencedCardId } : {}),
    },
  });

  publisher
    .publish(
      board.id,
      JSON.stringify({ type: 'attachment_added', entity_id: resolvedCardId, payload: { attachmentId } }),
    )
    .catch(() => {});

  return Response.json({ data: attachment }, { status: 201 });
}
