// Idempotency guard for trigger runs.
// Generates deterministic keys and rejects duplicate enqueues (Sprint 173).

import type { EnqueueTriggerInput } from '../../common/types';

/**
 * Generate a deterministic idempotency key from the enqueue input.
 * Format: cardId:listId:phase:moveEventId
 */
export function generateIdempotencyKey({
  cardId,
  listId,
  phase,
  moveEventId,
}: EnqueueTriggerInput): string {
  return `${cardId}:${listId}:${phase}:${moveEventId}`;
}

/**
 * Check whether a trigger run with the given idempotency key already exists.
 * Returns true if a duplicate exists, false otherwise.
 *
 * Relies on the DB UNIQUE constraint on (card_id, list_id, phase, move_event_id)
 * added by the iteration 6 migration.
 */
export async function isDuplicateRun(
  db: any,
  idempotencyKey: string,
): Promise<boolean> {
  const existing = await db('card_phase_trigger_runs')
    .where({ idempotency_key: idempotencyKey })
    .first();
  return !!existing;
}
