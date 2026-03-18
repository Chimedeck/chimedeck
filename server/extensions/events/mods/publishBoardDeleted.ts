// server/extensions/events/mods/publishBoardDeleted.ts
// Writes a board_deleted event and fans out a workspace-scoped notification to
// every workspace member's personal channel so all connected clients can remove
// the board from their UI without polling.
import { db } from '../../../common/db';
import { writeEvent } from '../../../mods/events/write';
import { publishToUser } from '../../realtime/userChannel';
import { pubsub } from '../../../mods/pubsub/index';

export interface PublishBoardDeletedInput {
  boardId: string;
  workspaceId: string;
  actorId: string;
}

export interface PublishBoardDeletedResult {
  eventId: string;
}

export async function publishBoardDeleted({
  boardId,
  workspaceId,
  actorId,
}: PublishBoardDeletedInput): Promise<PublishBoardDeletedResult> {
  const event = await writeEvent({
    type: 'board_deleted',
    // boardId is intentionally omitted — the board no longer exists and its
    // channel will receive no new subscribers. Workspace members are notified
    // through their personal user channels below.
    boardId: null,
    entityId: boardId,
    actorId,
    payload: { boardId, workspaceId },
  });

  // Build the workspace-scoped message that clients use to remove the board
  // from every board list view without a page reload.
  const message = {
    type: 'board_deleted',
    entity_id: boardId,
    actor_id: actorId,
    payload: { boardId, workspaceId },
    version: Number(event.sequence),
    sequence: event.sequence.toString(),
    timestamp: event.created_at,
    emittedAt: Date.now(),
  };

  // Publish on the workspace channel for any pubsub subscribers
  // (e.g. future workspace-scoped SSE or WS rooms).
  pubsub.publish(`workspace:${workspaceId}`, JSON.stringify(message)).catch(() => {});

  // Fan out directly to connected workspace member sockets so the event is
  // received immediately regardless of whether the client is watching a board.
  const members = await db('memberships')
    .where({ workspace_id: workspaceId })
    .select('user_id');

  for (const member of members) {
    publishToUser(member.user_id, message);
  }

  return { eventId: event.id };
}
