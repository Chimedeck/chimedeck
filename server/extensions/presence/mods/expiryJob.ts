// server/extensions/presence/mods/expiryJob.ts
// Background job: scans for expired presence keys every 10 s and fires
// `presence_update` WS events so clients remove stale avatars promptly.
//
// WHY: the TTL-based expiry in Redis/node-cache removes the key silently;
// this job detects the expiry and broadcasts a leave event to all board subscribers.
import { cache } from '../../../mods/cache/index';
import { db } from '../../../common/db';
import { broadcastPresenceUpdate } from '../api/presenceUpdate';

// Board IDs that currently have at least one subscribed WS client.
// The realtime module populates this set; we import it lazily to avoid
// circular dependencies at module load time.
let getActiveBoardIds: () => Set<string> = () => new Set();

export function setActiveBoardIds(fn: () => Set<string>): void {
  getActiveBoardIds = fn;
}

// Tracks the set of users known to be present per board so we can detect departures.
const knownPresence = new Map<string, Set<string>>();

export async function runExpiryCheck(): Promise<void> {
  const boardIds = getActiveBoardIds();

  for (const boardId of boardIds) {
    const keys = await cache.keys(`presence:${boardId}:*`);
    const currentUserIds = new Set(keys.map((k) => k.split(':')[2]).filter(Boolean) as string[]);

    const previous = knownPresence.get(boardId) ?? new Set<string>();

    // Detect new joins
    for (const uid of currentUserIds) {
      if (!previous.has(uid)) {
        await broadcastPresenceUpdate({ boardId, action: 'join', userId: uid });
      }
    }

    // Detect leaves (expired keys)
    for (const uid of previous) {
      if (!currentUserIds.has(uid)) {
        await broadcastPresenceUpdate({ boardId, action: 'leave', userId: uid });
      }
    }

    knownPresence.set(boardId, currentUserIds);
  }
}

const INTERVAL_MS = 10_000;

export function startExpiryJob(getBoardIds: () => Set<string>): void {
  setActiveBoardIds(getBoardIds);
  setInterval(() => {
    runExpiryCheck().catch(() => {
      // Non-critical — silently ignore errors in background job
    });
  }, INTERVAL_MS);
}
