// server/extensions/realtime/mods/rooms/broadcast.ts
// Broadcasts a serialised event message to all WebSocket clients in a board room.
import { rooms } from './index';

export function broadcast({ boardId, message }: { boardId: string; message: string }): void {
  const room = rooms.get(boardId);
  if (!room) return;

  for (const ws of room) {
    try {
      ws.send(message);
    } catch {
      // Dead socket — will be cleaned up by heartbeat
    }
  }
}
