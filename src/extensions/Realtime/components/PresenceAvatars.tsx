// PresenceAvatars — displays avatar icons for currently active board members.
// Data seeded from GET /api/v1/boards/:id/presence on mount,
// then updated via `presence_update` WS events.
//
// WHY local state: presence is ephemeral and doesn't need Redux persistence.
import { useEffect, useState, useCallback } from 'react';
import type { RealtimeEvent } from '../client/socket';
import translations from '../translations/en.json';

export interface PresenceUser {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  color: string;
}

interface PresenceAvatarsProps {
  boardId: string;
  /** Latest WS event — parent passes it through on each incoming event */
  lastEvent: RealtimeEvent | null;
  /** API fetcher injected by parent — keeps component testable */
  fetchPresence: (boardId: string) => Promise<PresenceUser[]>;
}

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

function colorFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length] ?? '#6366f1';
}

function initials(displayName: string): string {
  return displayName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase();
}

const PresenceAvatars: React.FC<PresenceAvatarsProps> = ({
  boardId,
  lastEvent,
  fetchPresence,
}) => {
  const [users, setUsers] = useState<PresenceUser[]>([]);

  // Initial presence fetch
  useEffect(() => {
    fetchPresence(boardId).then(setUsers).catch(() => {
      // Non-critical — silently ignore
    });
  }, [boardId, fetchPresence]);

  const applyPresenceEvent = useCallback(
    (event: RealtimeEvent) => {
      if (event.type !== 'presence_update') return;
      const p = event.payload as { user: PresenceUser; action: 'join' | 'leave' } | undefined;
      if (!p) return;

      if (p.action === 'join') {
        setUsers((prev) => {
          if (prev.some((u) => u.userId === p.user.userId)) return prev;
          return [...prev, { ...p.user, color: colorFor(p.user.userId) }];
        });
      } else {
        setUsers((prev) => prev.filter((u) => u.userId !== p.user.userId));
      }
    },
    [],
  );

  // Apply WS events when they arrive
  useEffect(() => {
    if (lastEvent) applyPresenceEvent(lastEvent);
  }, [lastEvent, applyPresenceEvent]);

  if (users.length === 0) return null;

  const MAX_VISIBLE = 5;
  const visible = users.slice(0, MAX_VISIBLE);
  const overflow = users.length - MAX_VISIBLE;

  return (
    <div className="flex items-center gap-1" aria-label={translations['Realtime.ariaActiveBoardMembers']}>
      {visible.map((user) => (
        <div
          key={user.userId}
          title={user.displayName}
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-white"
          style={{ backgroundColor: user.avatarUrl ? undefined : colorFor(user.userId) }}
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            initials(user.displayName)
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-300 text-xs font-semibold text-gray-700 ring-2 ring-white"
          title={`${overflow} more active user${overflow > 1 ? 's' : ''}`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
};

export default PresenceAvatars;
