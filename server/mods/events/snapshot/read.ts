// server/mods/events/snapshot/read.ts
// Load the latest snapshot + delta events since snapshot for a board.
import { db } from '../../../common/db';
import { readEventsSince } from '../read';
import type { WrittenEvent } from '../write';

export interface SnapshotWithDelta {
  snapshot: { state: Record<string, unknown>; lastSequence: bigint } | null;
  deltaEvents: WrittenEvent[];
}

export async function readSnapshotWithDelta({ boardId }: { boardId: string }): Promise<SnapshotWithDelta> {
  const snapshot = await db('board_snapshots').where({ board_id: boardId }).first();

  if (!snapshot) {
    const allEvents = await readEventsSince({ boardId, since: 0 });
    return { snapshot: null, deltaEvents: allEvents };
  }

  const deltaEvents = await readEventsSince({ boardId, since: snapshot.last_sequence });
  return {
    snapshot: {
      state: typeof snapshot.state === 'string' ? JSON.parse(snapshot.state) : snapshot.state,
      lastSequence: BigInt(snapshot.last_sequence),
    },
    deltaEvents,
  };
}
