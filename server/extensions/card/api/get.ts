// GET /api/v1/cards/:id — get full card detail; min role: VIEWER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { VISIBLE_EVENT_TYPES } from '../../activity/config/visibleEventTypes';
import { resolveAvatarUrlsInCollection } from '../../../common/avatar/resolveAvatarUrl';

export async function handleGetCard(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const card = await db('cards').where({ id: cardId }).first();
  if (!card) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card not found' } },
      { status: 404 },
    );
  }

  const list = await db('lists').where({ id: card.list_id }).first();
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;

  if (!list || !board) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card context not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  // Populate extended fields (sprint 08)
  const labelRows = await db('labels')
    .join('card_labels', 'labels.id', 'card_labels.label_id')
    .where('card_labels.card_id', cardId)
    .select('labels.*');

  const memberRows = await db('users')
    .join('card_members', 'users.id', 'card_members.user_id')
    .where('card_members.card_id', cardId)
    .select('users.id', 'users.email', 'users.name', 'users.avatar_url');

  const members = await resolveAvatarUrlsInCollection(
    memberRows as Array<{ avatar_url?: string | null } & Record<string, unknown>>,
  );

  const checklistItems = await db('checklist_items')
    .where({ card_id: cardId })
    .orderBy('position', 'asc');

  const url = new URL(req.url);
  const includes = url.searchParams.get('include')?.split(',') ?? [];

  let activities: unknown[] = [];
  if (includes.includes('activities')) {
    const rows = await db('activities')
      .where({ entity_id: cardId })
      .whereIn('action', VISIBLE_EVENT_TYPES)
      .orderBy('created_at', 'asc');

    const actorIds = [...new Set(rows.map((a) => a.actor_id))];
    const actors = actorIds.length
      ? await db('users').whereIn('id', actorIds).select('id', 'name', 'email')
      : [];
    const actorMap = new Map(actors.map((u) => [u.id, u]));

    activities = rows.map((a) => {
      const actor = actorMap.get(a.actor_id);
      return { ...a, actor_name: actor?.name ?? null, actor_email: actor?.email ?? null };
    });
  }

  const customFieldValues = await db('card_custom_field_values').where({ card_id: cardId });

  return Response.json({
    data: card,
    includes: {
      list,
      board: { id: board.id, title: board.title },
      labels: labelRows,
      members,
      checklistItems,
      comments: [],
      attachments: [],
      activities,
      customFieldValues,
    },
  });
}
