// server/extensions/realtime/mods/rooms/unsubscribe.ts
// Handles board unsubscription for a WebSocket client.
import type { ServerWebSocket } from 'bun';
import { rooms, type WsData } from './index';
import { subscriber } from '../../../../mods/pubsub/subscriber';
import { cache } from '../../../../mods/cache/index';
import { broadcastPresenceUpdate } from '../../../presence/api/presenceUpdate';

export async function unsubscribeFromBoard({
  ws,
  boardId,
}: {
  ws: ServerWebSocket<WsData>;
  boardId: string;
}): Promise<void> {
  const room = rooms.get(boardId);
  if (room) {
    room.delete(ws);
    if (room.size === 0) {
      rooms.delete(boardId);
      // [why] Keep pubsub subscriptions in lockstep with room lifecycle.
      // Without this, re-subscribing the same board can fail on adapters that
      // disallow duplicate channel subscriptions.
      await subscriber.unsubscribeBoard(boardId);
    }
  }
  ws.data.subscribedBoards.delete(boardId);

  const key = `presence:${boardId}:${ws.data.userId}`;
  await cache.del(key);

  // Broadcast leave event to remaining board subscribers (sprint 13)
  broadcastPresenceUpdate({ boardId, action: 'leave', userId: ws.data.userId }).catch(() => {});
}
