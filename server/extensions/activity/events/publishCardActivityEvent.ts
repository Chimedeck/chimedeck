// server/extensions/activity/events/publishCardActivityEvent.ts
// Broadcasts a card_activity_created realtime event to the board room so that
// all connected clients with the card modal open can append the new row without
// a page reload.
//
// [why] The board room already includes all users currently viewing that board,
// which is exactly the audience that needs live activity feed updates. We reuse
// the existing publisher/broadcast infrastructure rather than adding a new
// card-specific channel.
import { db } from '../../../common/db';
import { publisher } from '../../../mods/pubsub/publisher';
import { resolveAvatarUrlsInCollection } from '../../../common/avatar/resolveAvatarUrl';
import type { WrittenActivity } from '../mods/write';

export interface PublishCardActivityEventInput {
  activity: WrittenActivity;
  boardId: string;
}

export async function publishCardActivityEvent({
  activity,
  boardId,
}: PublishCardActivityEventInput): Promise<void> {
  // Resolve actor display info so clients can render the row without a follow-up request.
  const rawActors = await db('users')
    .where({ id: activity.actor_id })
    .select('id', 'name', 'email', 'avatar_url');
  const actors = await resolveAvatarUrlsInCollection(rawActors);
  const actor = actors[0] ?? null;

  const message = JSON.stringify({
    type: 'card_activity_created',
    entity_id: activity.entity_id,
    actor_id: activity.actor_id,
    payload: {
      activity: {
        id: activity.id,
        entity_type: activity.entity_type,
        entity_id: activity.entity_id,
        board_id: activity.board_id,
        action: activity.action,
        actor_id: activity.actor_id,
        actor_name: actor?.name ?? null,
        actor_email: actor?.email ?? null,
        actor_avatar_url: actor?.avatar_url ?? null,
        payload: activity.payload,
        created_at:
          activity.created_at instanceof Date
            ? activity.created_at.toISOString()
            : activity.created_at,
      },
    },
    emittedAt: Date.now(),
  });

  // Fire-and-forget; a delivery failure does not roll back the activity write.
  publisher.publish(boardId, message).catch(() => {});
}
