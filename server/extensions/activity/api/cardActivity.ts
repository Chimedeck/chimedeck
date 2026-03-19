// GET /api/v1/cards/:id/activity — card activity feed; min role: VIEWER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { VISIBLE_EVENT_TYPES } from '../config/visibleEventTypes';
import { resolveAvatarUrlsInCollection } from '../../../common/avatar/resolveAvatarUrl';

export async function handleCardActivity(req: Request, cardId: string): Promise<Response> {
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
  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const activities = await db('activities')
    .where({ entity_id: cardId })
    .whereIn('action', VISIBLE_EVENT_TYPES)
    // [why] Secondary sort by id ensures deterministic ordering when two events share
    //       the same created_at timestamp (e.g. batch-emitted events or test fixtures).
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc');

  // Join actor display info so the client never has to resolve IDs separately
  const actorIds = [...new Set(activities.map((a) => a.actor_id))];
  const rawActors = actorIds.length
    ? await db('users').whereIn('id', actorIds).select('id', 'name', 'email', 'avatar_url')
    : [];
  const actors = await resolveAvatarUrlsInCollection(rawActors);
  const actorMap = new Map(actors.map((u) => [u.id, u]));

  const data = activities.map((a) => {
    const actor = actorMap.get(a.actor_id);
    return {
      ...a,
      actor_name: actor?.name ?? null,
      actor_email: actor?.email ?? null,
      actor_avatar_url: actor?.avatar_url ?? null,
    };
  });

  return Response.json({ data });
}
