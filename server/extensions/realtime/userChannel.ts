// server/extensions/realtime/userChannel.ts
// Typed helpers for publishing to and registering user personal WS channels.
// The user channel key is `user:<userId>`, distinct from board channels.
//
// WHY: notifications (and future personal events) need to reach a specific
// user regardless of which board they are viewing — separate from board rooms.
import { rooms } from './mods/rooms/index';
import type { WsData } from './mods/rooms/index';
import type { ServerWebSocket } from 'bun';

// Map from userId → Set of connected sockets (a user may have multiple tabs)
export const userSockets = new Map<string, Set<ServerWebSocket<WsData>>>();

/** Register a connected WebSocket under its authenticated userId. */
export function registerUserSocket(ws: ServerWebSocket<WsData>): void {
  const { userId } = ws.data;
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId)!.add(ws);
}

/** Deregister a WebSocket from its userId entry (on close). */
export function deregisterUserSocket(ws: ServerWebSocket<WsData>): void {
  const { userId } = ws.data;
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  sockets.delete(ws);
  if (sockets.size === 0) userSockets.delete(userId);
}

/** Send a JSON message to all open sockets belonging to a user. */
export function publishToUser(userId: string, message: object): void {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  const raw = JSON.stringify(message);
  for (const ws of sockets) {
    try {
      ws.send(raw);
    } catch {
      // Dead socket — will be cleaned up by heartbeat
    }
  }
}
