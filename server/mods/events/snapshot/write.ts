// server/mods/events/snapshot/write.ts
// Persist or update a BoardSnapshot (upsert by board_id).
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';

export interface WriteSnapshotInput {
  boardId: string;
  state: Record<string, unknown>;
  lastSequence: bigint | number | string;
}

export async function writeSnapshot(input: WriteSnapshotInput): Promise<void> {
  const existing = await db('board_snapshots').where({ board_id: input.boardId }).first();
  if (existing) {
    await db('board_snapshots').where({ board_id: input.boardId }).update({
      state: JSON.stringify(input.state),
      last_sequence: String(input.lastSequence),
      created_at: new Date().toISOString(),
    });
  } else {
    await db('board_snapshots').insert({
      id: randomUUID(),
      board_id: input.boardId,
      state: JSON.stringify(input.state),
      last_sequence: String(input.lastSequence),
      created_at: new Date().toISOString(),
    });
  }
}
