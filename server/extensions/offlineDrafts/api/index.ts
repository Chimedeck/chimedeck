// Draft API router for card-scoped user drafts.
// Endpoints:
//   GET    /api/v1/cards/:cardId/drafts            — list current user's drafts for a card
//   PUT    /api/v1/cards/:cardId/drafts/description — upsert description draft
//   PUT    /api/v1/cards/:cardId/drafts/comment     — upsert comment draft
//   DELETE /api/v1/cards/:cardId/drafts/:type       — delete a draft by type
//
// All endpoints are scoped to the authenticated user. A 404 is returned when
// a draft does not exist (no existence leak for other users' drafts).
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { db } from '../../../common/db';
import { getDraftsByCard, upsertDraft, deleteDraft } from '../mods/drafts';

const VALID_DRAFT_TYPES = new Set(['description', 'comment'] as const);
type DraftType = 'description' | 'comment';
const VALID_INTENTS = new Set(['editing', 'save_pending', 'submit_pending'] as const);

// [why] Validates that the card exists and the requester has access to it via board membership.
async function resolveCard({
  cardId,
  userId,
}: {
  cardId: string;
  userId: string;
}): Promise<{ card: Record<string, unknown> } | Response> {
  const card = await db('cards')
    .join('boards', 'cards.board_id', 'boards.id')
    .leftJoin('board_members', (join) => {
      join.on('board_members.board_id', 'boards.id').andOn(
        db.raw('board_members.user_id = ?', [userId]),
      );
    })
    .where('cards.id', cardId)
    .where((qb) => {
      qb.where('boards.visibility', 'public').orWhereNotNull('board_members.id');
    })
    .select('cards.*')
    .first();

  if (!card) {
    return Response.json({ name: 'card-not-found' }, { status: 404 });
  }

  return { card };
}

export async function offlineDraftsRouter(
  req: Request,
  pathname: string,
): Promise<Response | null> {
  // Match /api/v1/cards/:cardId/drafts
  const draftListMatch = pathname.match(/^\/api\/v1\/cards\/([^/]+)\/drafts$/);
  if (draftListMatch && req.method === 'GET') {
    return handleListDrafts(req, draftListMatch[1]!);
  }

  // Match /api/v1/cards/:cardId/drafts/:type (PUT or DELETE)
  const draftTypeMatch = pathname.match(/^\/api\/v1\/cards\/([^/]+)\/drafts\/([^/]+)$/);
  if (draftTypeMatch) {
    const cardId = draftTypeMatch[1]!;
    const draftType = draftTypeMatch[2]!;

    if (req.method === 'PUT') {
      return handleUpsertDraft(req, cardId, draftType);
    }
    if (req.method === 'DELETE') {
      return handleDeleteDraft(req, cardId, draftType);
    }
  }

  return null;
}

async function handleListDrafts(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  const cardResult = await resolveCard({ cardId, userId });
  if (cardResult instanceof Response) return cardResult;

  const drafts = await getDraftsByCard({ userId, cardId });

  return Response.json({
    data: drafts.map((d) => ({
      id: d.id,
      card_id: d.card_id,
      draft_type: d.draft_type,
      content_markdown: d.content_markdown,
      intent: d.intent,
      client_updated_at: d.client_updated_at,
      synced_at: d.synced_at,
      created_at: d.created_at,
      updated_at: d.updated_at,
    })),
  });
}

async function handleUpsertDraft(
  req: Request,
  cardId: string,
  draftType: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  if (!VALID_DRAFT_TYPES.has(draftType as DraftType)) {
    return Response.json(
      { name: 'invalid-draft-type', data: { message: `draft type must be one of: description, comment` } },
      { status: 400 },
    );
  }

  const cardResult = await resolveCard({ cardId, userId });
  if (cardResult instanceof Response) return cardResult;

  const card = cardResult.card as Record<string, string>;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      { name: 'invalid-request-body', data: { message: 'Request body must be valid JSON' } },
      { status: 400 },
    );
  }

  const contentMarkdown = typeof body.content_markdown === 'string' ? body.content_markdown : '';
  const intent = body.intent as string;
  const clientUpdatedAt = body.client_updated_at as string;

  if (!intent || !VALID_INTENTS.has(intent as 'editing' | 'save_pending' | 'submit_pending')) {
    return Response.json(
      { name: 'invalid-intent', data: { message: `intent must be one of: editing, save_pending, submit_pending` } },
      { status: 400 },
    );
  }

  if (!clientUpdatedAt || typeof clientUpdatedAt !== 'string') {
    return Response.json(
      { name: 'missing-client-updated-at', data: { message: 'client_updated_at is required' } },
      { status: 400 },
    );
  }

  const draft = await upsertDraft({
    userId,
    cardId,
    draftType: draftType as DraftType,
    contentMarkdown,
    intent: intent as 'editing' | 'save_pending' | 'submit_pending',
    clientUpdatedAt,
    workspaceId: card.workspace_id as string,
    boardId: card.board_id as string,
  });

  return Response.json({
    data: {
      id: draft.id,
      card_id: draft.card_id,
      draft_type: draft.draft_type,
      content_markdown: draft.content_markdown,
      intent: draft.intent,
      client_updated_at: draft.client_updated_at,
      synced_at: draft.synced_at,
      created_at: draft.created_at,
      updated_at: draft.updated_at,
    },
  });
}

async function handleDeleteDraft(
  req: Request,
  cardId: string,
  draftType: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  if (!VALID_DRAFT_TYPES.has(draftType as DraftType)) {
    return Response.json(
      { name: 'invalid-draft-type', data: { message: `draft type must be one of: description, comment` } },
      { status: 400 },
    );
  }

  // [why] Check card access but return 404 regardless of reason to avoid leaking existence.
  const cardResult = await resolveCard({ cardId, userId });
  if (cardResult instanceof Response) return cardResult;

  const deleted = await deleteDraft({ userId, cardId, draftType });
  if (!deleted) {
    return Response.json({ name: 'draft-not-found' }, { status: 404 });
  }

  return Response.json({ data: {} });
}
