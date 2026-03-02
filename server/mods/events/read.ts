// server/mods/events/read.ts
// Fetch events for a board since a given sequence (exclusive), ordered ascending, up to limit.
import { db } from '../../common/db';
import type { WrittenEvent } from './write';

export async function readEventsSince({
  boardId,
  since,
  limit = 100,
}: {
  boardId: string;
  since: bigint | number | string;
  limit?: number;
}): Promise<WrittenEvent[]> {
  const rows = await db('events')
    .where({ board_id: boardId })
    .where('sequence', '>', String(since))
    .orderBy('sequence', 'asc')
    .limit(limit);

  return rows as WrittenEvent[];
}
