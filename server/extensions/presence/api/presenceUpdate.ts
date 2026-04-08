// server/extensions/presence/api/presenceUpdate.ts
// Fetches user info and broadcasts a `presence_update` WS event to board subscribers.
// Called on subscribe, unsubscribe/disconnect, and from the expiry job.
import { db } from '../../../common/db';
import { broadcast } from '../../realtime/mods/rooms/broadcast';
import { buildAvatarProxyUrl } from '../../../common/avatar/resolveAvatarUrl';

export async function broadcastPresenceUpdate({
  boardId,
  action,
  userId,
}: {
  boardId: string;
  action: 'join' | 'leave';
  userId: string;
}): Promise<void> {
  const user = await db('users').where({ id: userId }).select('id', 'name', 'avatar_url').first();
  if (!user) return;
  const avatarUrl = buildAvatarProxyUrl({ userId: user.id, avatarUrl: user.avatar_url ?? null });

  const payload = {
    type: 'presence_update',
    board_id: boardId,
    // WHY: per spec the event carries user info so clients don't need a follow-up fetch
    user: {
      userId: user.id,
      displayName: user.name,
      avatarUrl: avatarUrl ?? undefined,
    },
    action,
  };

  broadcast({ boardId, message: JSON.stringify(payload) });
}
