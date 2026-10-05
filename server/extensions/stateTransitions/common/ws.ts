import { publisher } from '../../../mods/pubsub/publisher';
import { invalidateRulesCacheFromStateTransitionEvent } from '../enforcement/rules';
import { invalidatePhaseCacheFromStateTransitionEvent } from '../mods/phaseResolver';
import type { StateTransitionGraph, StateTransitionUpdatedEvent } from './types';

type BroadcastStateTransitionUpdatedInput = {
  boardId: string;
  actorId: string;
  enabled: boolean;
  graph: StateTransitionGraph;
  updatedAt: string | Date;
};

export async function broadcastStateTransitionUpdated({
  boardId,
  actorId,
  enabled,
  graph,
  updatedAt,
}: BroadcastStateTransitionUpdatedInput): Promise<void> {
  const payload: StateTransitionUpdatedEvent = {
    type: 'state_transition_updated',
    board_id: boardId,
    payload: {
      enabled,
      graph,
    },
    actor_id: actorId,
    timestamp: new Date(updatedAt).toISOString(),
  };

  // [why] Invalidate caches BEFORE publishing so WS receivers read fresh data.
  invalidateRulesCacheFromStateTransitionEvent(payload);
  invalidatePhaseCacheFromStateTransitionEvent(payload);
  await publisher.publish(boardId, JSON.stringify(payload));
}
