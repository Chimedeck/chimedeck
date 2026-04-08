// server/extensions/realtime/userChannel.ts
// Typed helpers for publishing to and registering user personal WS channels.
// The user channel key is `user:<userId>`, distinct from board channels.
//
// WHY: notifications (and future personal events) need to reach a specific
// user regardless of which board they are viewing — separate from board rooms.
// Messages are routed via pubsub so that all server instances deliver to their
// locally-connected sockets (multi-instance support).
import type { WsData } from './mods/rooms/index';
import type { ServerWebSocket } from 'bun';
import { pubsub } from '../../mods/pubsub/index';

// Map from userId → Set of connected sockets (a user may have multiple tabs)
export const userSockets = new Map<string, Set<ServerWebSocket<WsData>>>();

// Track which userIds already have an active pubsub subscription so we only
// create one subscriber per user (even across multiple open tabs).
const subscribedUsers = new Set<string>();

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

/**
 * Subscribe this server instance to the user's pubsub channel so that
 * publishToUser calls on any instance are delivered to locally-connected sockets.
 * Idempotent — safe to call on every new socket open for the same user.
 */
export async function subscribeUserChannel(userId: string): Promise<void> {
  if (subscribedUsers.has(userId)) return;
  subscribedUsers.add(userId);

  await pubsub.subscribe(`user:${userId}`, (message) => {
    try {
      const msg = JSON.parse(message) as object;
      const sockets = userSockets.get(userId);
      if (!sockets) return;

      const raw = JSON.stringify(msg);
      for (const ws of sockets) {
        try {
          ws.send(raw);
        } catch {
          // Dead socket — will be cleaned up by heartbeat
        }
      }
    } catch {
      // Malformed pubsub message — ignore.
    }
  });
}

/**
 * Unsubscribe from the user's pubsub channel once the last socket for this
 * user has disconnected.  Safe to call on every socket close.
 */
export async function unsubscribeUserChannel(userId: string): Promise<void> {
  // Only remove the pubsub listener when the last socket for this user has gone.
  const sockets = userSockets.get(userId);
  if (sockets && sockets.size > 0) return;

  subscribedUsers.delete(userId);
  await pubsub.unsubscribe(`user:${userId}`);
}

/** Route a JSON message to all open sockets belonging to a user via pubsub. */
export async function publishToUser(userId: string, message: object): Promise<void> {
  await pubsub.publish(`user:${userId}`, JSON.stringify(message));
}
