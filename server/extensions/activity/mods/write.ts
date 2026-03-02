// Append-only writer for the Activity audit log.
// IMPORTANT: No UPDATE or DELETE operations are allowed on the activities table.
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';

export interface WriteActivityInput {
  entityType: 'card' | 'board' | 'list' | 'workspace';
  entityId: string;
  boardId?: string | null;
  action: string;
  actorId: string;
  payload: Record<string, unknown>;
}

export interface WrittenActivity {
  id: string;
  entity_type: string;
  entity_id: string;
  board_id: string | null;
  action: string;
  actor_id: string;
  payload: Record<string, unknown>;
  created_at: Date;
}

export async function writeActivity(input: WriteActivityInput): Promise<WrittenActivity> {
  const id = randomUUID();
  const [activity] = await db('activities').insert({
    id,
    entity_type: input.entityType,
    entity_id: input.entityId,
    board_id: input.boardId ?? null,
    action: input.action,
    actor_id: input.actorId,
    payload: JSON.stringify(input.payload),
    created_at: new Date().toISOString(),
  }, ['*']);

  return activity as WrittenActivity;
}
