// server/extensions/realtime/mods/conflictHandler.ts
// Central place to record optimistic-update conflicts via OTel.
// Increment realtime.conflicts whenever the server detects that a client's
// optimistic mutation is irreconcilable with the current server state.
import { getMetrics } from '../../../mods/observability/index';

export interface ConflictContext {
  boardId: string;
  entityType: string;
}

/**
 * Call this whenever conflict resolution happens (e.g. a mutation replay returns
 * 409 or a position collision is detected).  Safe to call when OTEL_ENABLED=false
 * — the counter is a no-op in that case.
 */
export function recordConflict({ boardId, entityType }: ConflictContext): void {
  getMetrics().realtimeConflicts.add(1, { boardId, entityType });
  // Also bump the legacy counter so existing dashboards are not broken
  getMetrics().conflictTotal.add(1, { boardId, entityType });
}
