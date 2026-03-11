// server/mods/events/write.ts
// Persist an Event row to the events table; returns the sequence number.
import { randomUUID } from 'crypto';
import { db } from '../../common/db';
import { checkAndWriteSnapshot } from './snapshot/policy';
import { publisher } from '../pubsub/publisher';

export interface WriteEventInput {
  type: string;
  boardId?: string | null;
  entityId: string;
  actorId: string;
  payload: Record<string, unknown>;
}

export interface WrittenEvent {
  id: string;
  type: string;
  board_id: string | null;
  entity_id: string;
  actor_id: string;
  payload: Record<string, unknown>;
  sequence: bigint;
  created_at: Date;
}

export async function writeEvent(input: WriteEventInput): Promise<WrittenEvent> {
  const id = randomUUID();
  const [event] = await db('events').insert({
    id,
    type: input.type,
    board_id: input.boardId ?? null,
    entity_id: input.entityId,
    actor_id: input.actorId,
    payload: JSON.stringify(input.payload),
    created_at: new Date().toISOString(),
  }, ['*']);

  if (input.boardId) {
    checkAndWriteSnapshot({ boardId: input.boardId, sequence: event.sequence }).catch(() => {});
    const message = JSON.stringify({
      type: event.type,
      entity_id: event.entity_id,
      actor_id: event.actor_id,
      payload: event.payload,
      // version mirrors sequence so clients can detect ordering gaps and duplicates (§8)
      version: Number(event.sequence),
      sequence: event.sequence.toString(),
      timestamp: event.created_at,
      // emittedAt: epoch ms when the server published this event; used by the client
      // to compute propagation delay for the realtime.propagation_delay_ms histogram.
      emittedAt: Date.now(),
    });
    publisher.publish(input.boardId, message).catch(() => {});
  }

  return event as WrittenEvent;
}
