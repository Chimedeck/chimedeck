// server/mods/events/snapshot/policy.ts
// Snapshot-every-N-events policy.
import { db } from '../../../common/db';
import { writeSnapshot } from './write';

const SNAPSHOT_INTERVAL = 50;

export async function checkAndWriteSnapshot({
  boardId,
  sequence,
}: {
  boardId: string;
  sequence: bigint | number | string;
}): Promise<void> {
  const snapshot = await db('board_snapshots').where({ board_id: boardId }).first();
  const lastSnapshotSeq = snapshot ? BigInt(snapshot.last_sequence) : BigInt(0);
  const currentSeq = BigInt(sequence);

  const countResult = await db('events')
    .where({ board_id: boardId })
    .where('sequence', '>', String(lastSnapshotSeq))
    .count('id as count')
    .first();

  const eventsSince = Number(countResult?.count ?? 0);

  if (eventsSince >= SNAPSHOT_INTERVAL) {
    const state = snapshot?.state
      ? (typeof snapshot.state === 'string' ? JSON.parse(snapshot.state) : snapshot.state)
      : {};

    await writeSnapshot({
      boardId,
      state,
      lastSequence: currentSeq,
    });
  }
}
