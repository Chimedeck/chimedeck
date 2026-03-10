// server/extensions/realtime/sessionRevocation.ts
// Subscribes to each user's personal session channel so that logout / password-reset
// can terminate all open WebSocket connections for that user in real time.
//
// WHY: when the server revokes a refresh token it publishes
// { type: 'session_revoked' } to `session:<userId>`.  Any open WS belonging
// to that user must be closed with code 4001 so the client can redirect to
// /login?reason=session_revoked.
import { pubsub } from '../../mods/pubsub/index';
import { userSockets } from './userChannel';

// Track which userIds already have an active pubsub subscription so we only
// create one subscriber per user (even across multiple open tabs).
const subscribedUsers = new Set<string>();

export async function subscribeSessionRevocation(userId: string): Promise<void> {
  if (subscribedUsers.has(userId)) return;
  subscribedUsers.add(userId);

  await pubsub.subscribe(`session:${userId}`, (message) => {
    try {
      const msg = JSON.parse(message) as { type: string };
      if (msg.type !== 'session_revoked') return;

      const sockets = userSockets.get(userId);
      if (!sockets) return;

      for (const ws of sockets) {
        try {
          ws.send(JSON.stringify({ type: 'session_revoked' }));
          ws.close(4001, 'session revoked');
        } catch {
          // Dead socket — already closed; ignore.
        }
      }
    } catch {
      // Malformed pubsub message — ignore.
    }
  });
}

export async function unsubscribeSessionRevocation(userId: string): Promise<void> {
  // Only remove the pubsub listener when the last socket for this user has gone.
  const sockets = userSockets.get(userId);
  if (sockets && sockets.size > 0) return;

  subscribedUsers.delete(userId);
  await pubsub.unsubscribe(`session:${userId}`);
}
