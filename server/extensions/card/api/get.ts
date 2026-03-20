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

  const checklistRows = await db('checklists')
    .where({ card_id: cardId })
    .orderBy('position', 'asc');

  const checklistItems = await db('checklist_items')
    .where({ card_id: cardId })
    .orderBy('position', 'asc');

  // Group items under their parent checklist; fall back to a virtual
  // default checklist for items that pre-date the migration.
  const itemsByChecklistId = new Map<string, typeof checklistItems>();
  for (const item of checklistItems) {
    const key = item.checklist_id ?? '__ungrouped__';
    if (!itemsByChecklistId.has(key)) itemsByChecklistId.set(key, []);
    itemsByChecklistId.get(key)!.push(item);
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
    const rows = await db('activities')
      .where({ entity_id: cardId })
      .whereIn('action', VISIBLE_EVENT_TYPES)
      .orderBy('created_at', 'asc');

    const actorIds = [...new Set(rows.map((a) => a.actor_id))];
    const rawActors = actorIds.length
      ? await db('users').whereIn('id', actorIds).select('id', 'name', 'email', 'avatar_url')
      : [];
    const resolvedActors = await resolveAvatarUrlsInCollection(rawActors);
    const actorMap = new Map(resolvedActors.map((u) => [u.id, u]));

    activities = rows.map((a) => {
      const actor = actorMap.get(a.actor_id);
      return { ...a, actor_name: actor?.name ?? null, actor_email: actor?.email ?? null, actor_avatar_url: actor?.avatar_url ?? null };
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
      checklists,
      checklistItems,
      comments: [],
      attachments: [],
      activities,
      customFieldValues,
    },
  });
}
