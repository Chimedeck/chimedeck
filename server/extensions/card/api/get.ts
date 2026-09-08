// GET /api/v1/cards/:id — get full card detail; min role: VIEWER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { VISIBLE_EVENT_TYPES } from '../../activity/config/visibleEventTypes';
import { buildAvatarProxyUrlsInCollection } from '../../../common/avatar/resolveAvatarUrl';
import { resolveCoverImageUrl } from '../../../common/cards/cover';

interface CardRow {
  id: string;
  list_id: string;
  cover_attachment_id: string | null;
}

interface ListRow {
  id: string;
  board_id: string;
}

interface BoardRow {
  id: string;
  workspace_id: string;
  short_id: string;
  title: string;
}

interface ChecklistRow extends Record<string, unknown> {
  id: string;
  card_id: string;
  title: string;
  position: string;
}

interface ChecklistItemRow extends Record<string, unknown> {
  id: string;
  checklist_id: string | null;
}

interface ActivityRow extends Record<string, unknown> {
  actor_id: string | null;
}

interface ActorRow extends Record<string, unknown> {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export async function handleGetCard(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const card = await db<CardRow>('cards').where({ id: cardId }).first();
  if (!card) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card not found' } },
      { status: 404 },
    );
  }

  const list = await db<ListRow>('lists').where({ id: card.list_id }).first();
  const board = list ? await db<BoardRow>('boards').where({ id: list.board_id }).first() : null;

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

  const members = buildAvatarProxyUrlsInCollection(
    memberRows as Array<{ avatar_url?: string | null } & Record<string, unknown>>,
  );

  const checklistRows = await db<ChecklistRow>('checklists')
    .where({ card_id: cardId })
    .orderBy('created_at', 'asc')
    .orderBy('position', 'asc');

  const checklistItems = await db<ChecklistItemRow>('checklist_items')
    .where({ card_id: cardId })
    .orderBy('position', 'asc');

  // Group items under their parent checklist; fall back to a virtual
  // default checklist for items that pre-date the migration.
  const itemsByChecklistId = new Map<string, typeof checklistItems>();
  for (const item of checklistItems) {
    const key = item.checklist_id ?? '__ungrouped__';
    const items = itemsByChecklistId.get(key) ?? [];
    items.push(item);
    itemsByChecklistId.set(key, items);
  }

  const checklists = checklistRows.map((cl) => ({
    ...cl,
    items: itemsByChecklistId.get(cl.id) ?? [],
  }));

  // Append any ungrouped items as a fallback checklist so old data is never lost
  const ungrouped = itemsByChecklistId.get('__ungrouped__') ?? [];
  if (ungrouped.length > 0) {
    checklists.push({ id: '__ungrouped__', card_id: cardId, title: 'Checklist', position: 'z', items: ungrouped });
  }

  const url = new URL(req.url);
  const includes = url.searchParams.get('include')?.split(',') ?? [];

  let activities: unknown[] = [];
  if (includes.includes('activities')) {
    const rows = await db<ActivityRow>('activities')
      .where({ entity_id: cardId })
      .andWhere((qb) => {
        qb.whereIn('action', VISIBLE_EVENT_TYPES).orWhere('action', 'card.description.updated');
      })
      .orderBy('created_at', 'asc');

    const actorIds = [...new Set(rows.flatMap((activity) => activity.actor_id ? [activity.actor_id] : []))];
    const rawActors = actorIds.length
      ? await db<ActorRow>('users').whereIn('id', actorIds).select('id', 'name', 'email', 'avatar_url')
      : [];
    const resolvedActors = buildAvatarProxyUrlsInCollection(rawActors);
    const actorMap = new Map(resolvedActors.map((u) => [u.id, u]));

    activities = rows.map((a) => {
      const actor = a.actor_id ? actorMap.get(a.actor_id) : undefined;
      return { ...a, actor_name: actor?.name ?? null, actor_email: actor?.email ?? null, actor_avatar_url: actor?.avatar_url ?? null };
    });
  }

  const customFieldValues = await db('card_custom_field_values').where({ card_id: cardId });

  const cardWithCover = await resolveCoverImageUrl(card as { id: string; cover_attachment_id?: string | null });

  return Response.json({
    data: cardWithCover,
    includes: {
      list,
      board: { id: board.id, short_id: board.short_id, title: board.title },
      labels: labelRows,
      members,
      checklists,
      checklistItems,
      comments: [],
      attachments: [],
      activities,
      customFieldValues,
    },
  });
}
