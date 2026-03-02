// server/extensions/realtime/mods/rooms/subscribe.ts
// Handles board subscription for a WebSocket client.
import type { ServerWebSocket } from 'bun';
import { rooms, type WsData } from './index';
import { subscriber } from '../../../../mods/pubsub/subscriber';
import { cache } from '../../../../mods/cache/index';

export async function subscribeToBoard({
  ws,
  boardId,
}: {
  ws: ServerWebSocket<WsData>;
  boardId: string;
}): Promise<void> {
  if (!rooms.has(boardId)) {
    rooms.set(boardId, new Set());
    await subscriber.subscribeBoard(boardId);
  }
  rooms.get(boardId)!.add(ws);
  ws.data.subscribedBoards.add(boardId);

  const key = `presence:${boardId}:${ws.data.userId}`;
  await cache.set(key, ws.data.userId, 35);
}
